import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../rpc-client";
import type { PageReferenceItem, PageReferenceRenderProps } from "./PageReferenceExtension";

/**
 * PageReferenceMenu - Autocomplete UI for [[page name]] links.
 * 
 * Shows a dropdown menu with page suggestions when typing `[[`.
 * Clicking a page inserts a link to that page.
 */

interface PageReferenceMenuProps {
  props: PageReferenceRenderProps;
}

export function PageReferenceMenu({ props }: PageReferenceMenuProps) {
  const { query, command } = props;
  const [pages, setPages] = useState<PageReferenceItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch pages matching the query
  useEffect(() => {
    const fetchPages = async () => {
      try {
        if (query.length > 0) {
          const results = await api.searchPages(query);
          const pageItems = results.map((page: any) => ({
            pageId: page.id,
            pageTitle: page.title,
          }));
          setPages(pageItems.slice(0, 10)); // Limit to 10 suggestions
        } else {
          // Show all pages if no query
          const results = await api.listPages();
          const pageItems = results.map((page: any) => ({
            pageId: page.id,
            pageTitle: page.title,
          }));
          setPages(pageItems.slice(0, 10));
        }
        setSelectedIndex(0);
      } catch (error) {
        console.error("Failed to search pages:", error);
        setPages([]);
      }
    };

    fetchPages();
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useRef((event: KeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : pages.length - 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < pages.length - 1 ? prev + 1 : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (pages[selectedIndex]) {
        command(pages[selectedIndex]);
      }
    }
  });

  useEffect(() => {
    const handler = handleKeyDown.current;
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pages, selectedIndex, command]);

  // Scroll selected item into view
  useEffect(() => {
    if (menuRef.current) {
      const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (pages.length === 0) {
    return (
      <div className="page-reference-menu-empty" style={{
        padding: "8px 12px",
        color: "#6b7280",
        fontSize: "14px",
      }}>
        No pages found
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="page-reference-menu"
      style={{
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        maxHeight: "200px",
        overflowY: "auto",
        minWidth: "200px",
      }}
    >
      {pages.map((page, index) => (
        <button
          key={page.pageId}
          className={`page-reference-item ${index === selectedIndex ? "selected" : ""}`}
          onClick={() => command(page)}
          onMouseEnter={() => setSelectedIndex(index)}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 12px",
            textAlign: "left",
            border: "none",
            background: index === selectedIndex ? "#f3f4f6" : "transparent",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <span className="page-reference-icon" style={{ marginRight: "8px", color: "#6b7280" }}>
            📄
          </span>
          {page.pageTitle}
        </button>
      ))}
    </div>
  );
}

/**
 * Creates a render function for the PageReference extension.
 * This function is called by Tiptap when the suggestion is triggered.
 */
export function createPageReferenceRender() {
  let component: ReturnType<typeof createRoot> | null = null;
  let popup: HTMLElement | null = null;

  return {
    onStart: (props: PageReferenceRenderProps) => {
      popup = document.createElement("div");
      popup.className = "page-reference-popup";
      popup.style.position = "absolute";
      popup.style.zIndex = "50";
      document.body.appendChild(popup);

      // Position popup near the cursor
      const { clientRect } = props;
      if (clientRect) {
        const rect = clientRect();
        if (rect) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 8}px`;
        }
      }

      component = createRoot(popup);
      component.render(<PageReferenceMenu props={props} />);
    },

    onUpdate: (props: PageReferenceRenderProps) => {
      if (!popup || !component) return;

      // Update position
      const { clientRect } = props;
      if (clientRect) {
        const rect = clientRect();
        if (rect) {
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 8}px`;
        }
      }

      component.render(<PageReferenceMenu props={props} />);
    },

    onKeyDown: (props: { event: KeyboardEvent }) => {
      // Handle navigation keys
      if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(props.event.key)) {
        return true; // Prevent default and let the menu handle it
      }
      return false;
    },

    onExit: () => {
      if (popup && component) {
        component.unmount();
        popup.remove();
        popup = null;
        component = null;
      }
    },
  };
}