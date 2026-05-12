import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useStore } from "../store.js";
import { DatabaseView } from "./DatabaseView.js";
import { SlashMenu } from "./SlashMenu.js";

export function BlockEditor() {
  const { currentPage, blocks, updateBlock, createBlock, createDatabase, updatePage, databases, loadDatabases } = useStore();
  const savingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const creatingBlockRef = useRef(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [slashMenu, setSlashMenu] = useState<{ show: boolean; query: string; top: number; left: number }>({ show: false, query: "", top: 0, left: 0 });
  const [newDbId, setNewDbId] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p></p>",
    autofocus: true,
    onUpdate: ({ editor }) => {
      if (!currentPage || savingRef.current) return;
      
      // Check for slash command
      const text = editor.getText();
      const cursor = editor.state.selection.anchor;
      const textBefore = text.slice(0, cursor - 1);
      const lineStart = textBefore.lastIndexOf("\n") + 1;
      const textOnLine = textBefore.slice(lineStart);
      
      if (textOnLine.startsWith("/")) {
        const query = textOnLine.slice(1);
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        setSlashMenu({
          show: true,
          query,
          top: coords.bottom,
          left: coords.left,
        });
      } else if (slashMenu.show && !textOnLine.includes("/")) {
        setSlashMenu((m) => ({ ...m, show: false }));
      }

      savingRef.current = true;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const html = editor.getHTML();
        const contentBlock = blocks.find((b) => b.type === "paragraph");
        if (contentBlock) {
          await updateBlock(contentBlock.id, html);
        } else if (!creatingBlockRef.current) {
          // Create a new block if one doesn't exist
          creatingBlockRef.current = true;
          await createBlock({
            pageId: currentPage.id,
            type: "paragraph",
            content: html,
            index: blocks.length,
            parentId: null,
          });
          creatingBlockRef.current = false;
        }
        savingRef.current = false;
      }, 500);
    },
  });

  useEffect(() => {
    if (!editor || !currentPage) return;
    const contentBlock = blocks.find((b) => b.type === "paragraph");
    if (contentBlock) {
      const currentHtml = editor.getHTML();
      // Update editor if block content differs from current editor content
      // Skip if we're currently saving (to avoid cursor jumps)
      if (!savingRef.current && currentHtml !== contentBlock.content) {
        editor.commands.setContent(contentBlock.content);
      }
    } else {
      // No content block yet, set empty content
      editor.commands.setContent("<p></p>");
    }
  }, [currentPage?.id, editor, blocks]);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTitleValue(currentPage?.title || "");
  };

  const handleTitleSave = async () => {
    if (currentPage && titleValue !== currentPage.title) {
      await updatePage(currentPage.id, titleValue);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
    }
  };

  const handleSlashCommand = async (command: string) => {
    if (!editor || !currentPage) return;
    
    // Get current selection and text
    const { from, to } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(0, from, "\n");
    const lineStart = textBefore.lastIndexOf("\n") + 1;
    const textOnLine = textBefore.slice(lineStart);
    const slashIndex = textOnLine.lastIndexOf("/");
    
    // Calculate position of the slash in the document
    const slashPos = from - textOnLine.length + slashIndex;
    
    // Close menu first
    setSlashMenu((m) => ({ ...m, show: false }));
    
    // Delete from slash to current cursor position
    if (slashIndex >= 0) {
      editor.chain().focus().deleteRange({ from: slashPos + 1, to: to }).run();
    }
    
    // Apply the command
    if (command === "database") {
      // Create inline database with default name
      const db = await createDatabase(currentPage.id, "Untitled");
      await loadDatabases(currentPage.id);
      setNewDbId(db.id);
    } else if (command === "heading1") {
      editor.chain().focus().setHeading({ level: 1 }).run();
    } else if (command === "heading2") {
      editor.chain().focus().setHeading({ level: 2 }).run();
    } else if (command === "heading3") {
      editor.chain().focus().setHeading({ level: 3 }).run();
    } else if (command === "bullet") {
      editor.chain().focus().toggleBulletList().run();
    } else if (command === "numbered") {
      editor.chain().focus().toggleOrderedList().run();
    } else if (command === "code") {
      editor.chain().focus().toggleCodeBlock().run();
    }
  };

  const slashCommands = [
    { id: "heading1", name: "Heading 1", icon: "H1", shortcut: "#" },
    { id: "heading2", name: "Heading 2", icon: "H2", shortcut: "##" },
    { id: "heading3", name: "Heading 3", icon: "H3", shortcut: "###" },
    { id: "bullet", name: "Bullet List", icon: "•", shortcut: "-" },
    { id: "numbered", name: "Numbered List", icon: "1.", shortcut: "1." },
    { id: "code", name: "Code Block", icon: "</>", shortcut: "```" },
    { id: "database", name: "Database", icon: "🗃️", shortcut: "/database" },
  ];

  if (!currentPage) {
    return (
      <div className="empty-state">
        <div>
          <h2>Welcome</h2>
          <p>Select a page from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      {isEditingTitle ? (
        <input
          type="text"
          className="page-title-input"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          placeholder="Page title..."
        />
      ) : (
        <h1 className="page-title" onClick={handleTitleClick} style={{ cursor: "pointer" }}>
          {currentPage.title || "Untitled"}
        </h1>
      )}

      <div className="editor">
        <EditorContent editor={editor} />
        
        {/* Slash Command Menu */}
        {slashMenu.show && editor && (
          <SlashMenu
            commands={slashCommands}
            query={slashMenu.query}
            position={{ top: slashMenu.top, left: slashMenu.left }}
            onSelect={handleSlashCommand}
            onClose={() => setSlashMenu((m) => ({ ...m, show: false }))}
          />
        )}
      </div>

      {/* Inline databases */}
      {databases.map((db) => (
        <div key={db.id} style={{ marginTop: 24 }}>
          <DatabaseView database={db} isNew={db.id === newDbId} />
        </div>
      ))}
    </div>
  );
}
