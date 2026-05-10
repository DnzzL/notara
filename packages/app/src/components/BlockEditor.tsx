import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useStore } from "../store.js";
import { DatabaseView } from "./DatabaseView.js";

export function BlockEditor() {
  const { currentPage, blocks, updateBlock, databases } = useStore();
  const savingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p></p>",
    autofocus: true,
    onUpdate: ({ editor }) => {
      if (!currentPage || savingRef.current) return;
      savingRef.current = true;

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const html = editor.getHTML();
        // Find or create a content block
        const contentBlock = blocks.find((b) => b.type === "paragraph");
        if (contentBlock) {
          updateBlock(contentBlock.id, html);
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
      if (currentHtml !== contentBlock.content && currentHtml !== "<p></p>") {
        editor.commands.setContent(contentBlock.content);
      }
    } else {
      // No content block yet, create one with empty content
      editor.commands.setContent("<p></p>");
    }
  }, [currentPage?.id, editor]);

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
      <h1 className="page-title">{currentPage.title || "Untitled"}</h1>

      <div className="editor">
        <EditorContent editor={editor} />
      </div>

      {databases.length > 0 && (
        <div style={{ marginTop: 32 }}>
          {databases.map((db) => (
            <DatabaseView key={db.id} database={db} />
          ))}
        </div>
      )}
    </div>
  );
}
