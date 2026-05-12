import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useStore } from "../store.js";
import { DatabaseView } from "./DatabaseView.js";

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
    editorProps: {
      handleKeyDown: (view, event) => {
        // Handle slash key
        if (event.key === "/") {
          const { from } = view.state.selection;
          const textBefore = view.state.doc.textBetween(0, from, "\n");
          const lineStart = textBefore.lastIndexOf("\n") + 1;
          const textOnLine = textBefore.slice(lineStart);
          
          // Check if we're at start of line or after space
          if (textOnLine === "" || textOnLine.endsWith(" ")) {
            const coords = view.coordsAtPos(from);
            setSlashMenu({
              show: true,
              query: "",
              top: coords.bottom,
              left: coords.left,
            });
          }
        }
        // Close menu on Escape
        if (event.key === "Escape") {
          setSlashMenu((m) => ({ ...m, show: false }));
        }
        return false;
      },
    },
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
    
    // Clear the slash from editor
    const text = editor.getText();
    const cursor = editor.state.selection.anchor;
    const textBefore = text.slice(0, cursor - 1);
    const lineStart = textBefore.lastIndexOf("\n") + 1;
    const slashPos = textBefore.indexOf("/", lineStart);
    
    if (slashPos >= 0) {
      editor.commands.deleteRange({ from: slashPos + 1, to: cursor });
    }
    setSlashMenu((m) => ({ ...m, show: false }));
    
    if (command === "database") {
      // Create inline database with default name
      const db = await createDatabase(currentPage.id, "Untitled");
      await loadDatabases(currentPage.id);
      setNewDbId(db.id);
    } else if (command === "heading1") {
      editor.commands.setHeading({ level: 1 });
    } else if (command === "heading2") {
      editor.commands.setHeading({ level: 2 });
    } else if (command === "heading3") {
      editor.commands.setHeading({ level: 3 });
    } else if (command === "bullet") {
      editor.commands.toggleBulletList();
    } else if (command === "numbered") {
      editor.commands.toggleOrderedList();
    } else if (command === "code") {
      editor.commands.toggleCodeBlock();
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
          <div
            className="slash-menu"
            style={{
              position: "absolute",
              top: slashMenu.top,
              left: slashMenu.left,
              zIndex: 100,
            }}
          >
            {slashCommands
              .filter((cmd) => cmd.name.toLowerCase().includes(slashMenu.query.toLowerCase()))
              .map((cmd) => (
                <button
                  key={cmd.id}
                  className="slash-menu-item"
                  onClick={() => handleSlashCommand(cmd.id)}
                >
                  <span className="slash-icon">{cmd.icon}</span>
                  <span>{cmd.name}</span>
                </button>
              ))}
          </div>
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
