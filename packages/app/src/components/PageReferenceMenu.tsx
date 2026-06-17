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
      <div className="px-3 py-3 text-text-3 text-[13.5px]" style={{
      }}>
        No pages found
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="bg-surface border border-border-mid rounded shadow-[var(--shadow-lg)] max-h-[280px] overflow-y-auto min-w-[220px]"
    >
      {pages.map((page, index) => (
        <button
          key={page.pageId}
          className={`flex items-center w-full px-3.5 py-[9px] border-none bg-transparent cursor-pointer text-[13.5px] text-left text-text-2 [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text ${index === selectedIndex ? "bg-surface-3 text-text" : ""}`}
          onClick={() => command(page)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="text-text-3 mr-2">
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
      popup.className = "absolute z-[50]";
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