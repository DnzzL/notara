import { Node, mergeAttributes, Extension } from "@tiptap/core";
import { Suggestion } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";

/**
 * PageReference extension for wiki-style [[page name]] links.
 * 
 * When typing `[[`, a suggestion menu appears with page titles.
 * Selecting a page creates a link node that navigates to that page.
 */

export interface PageReferenceItem {
  pageId: string;
  pageTitle: string;
}

export interface PageReferenceNodeOptions {
  HTMLAttributes: Record<string, any>;
  renderLabel: (props: PageReferenceItem) => string;
}

export const PageReferenceNode = Node.create<PageReferenceNodeOptions>({
  name: "pageReference",

  group: "inline",

  inline: true,

  selectable: false,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "page-reference",
      },
      renderLabel: ({ pageId, pageTitle }) => pageTitle,
    };
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-page-ref"),
        renderHTML: (attributes) => {
          if (!attributes.pageId) return {};
          return {
            "data-page-ref": attributes.pageId,
          };
        },
      },
      pageTitle: {
        default: null,
        parseHTML: (element) => element.textContent,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-page-ref]`,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = this.options.renderLabel({
      pageId: node.attrs.pageId as string,
      pageTitle: node.attrs.pageTitle as string,
    });
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      label,
    ];
  },
});

/**
 * PageReference extension with suggestion support.
 * Configured with items and render function for autocomplete.
 */
export interface PageReferenceExtensionOptions {
  items: (query: string) => Promise<PageReferenceItem[]> | PageReferenceItem[];
  render: () => {
    onStart?: (props: PageReferenceRenderProps) => void;
    onUpdate?: (props: PageReferenceRenderProps) => void;
    onKeyDown?: (props: { event: KeyboardEvent; range: Range }) => boolean;
    onExit?: (props: PageReferenceRenderProps) => void;
  };
}

export interface PageReferenceRenderProps {
  editor: Editor;
  range: Range;
  query: string;
  text: string;
  items: PageReferenceItem[];
  command: (props: PageReferenceItem) => void;
}

export const PageReferenceExtension = Extension.create<PageReferenceExtensionOptions>({
  name: "pageReferenceExtension",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "[[",
        allowSpaces: true,
        allowedPrefixes: [" ", "(", "["],
        startOfLine: false,
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: PageReferenceItem }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "pageReference",
              attrs: props,
            })
            .run();
        },
        items: ({ query }) => this.options.items(query),
        render: this.options.render,
      }),
    ];
  },
});

export default PageReferenceNode;

/**
 * Creates a render function for the page reference suggestion popup.
 * Returns the lifecycle callbacks expected by TipTap's Suggestion plugin.
 */
export function createPageReferenceRender() {
  let popup: HTMLElement | null = null;
  let currentIndex = 0;

  return {
    onStart: (props: PageReferenceRenderProps) => {
      popup = document.createElement("div");
      popup.className = "page-reference-popup";
      popup.style.position = "fixed";
      popup.style.zIndex = "1000";
      popup.style.background = "var(--bg-secondary, #1e1e1e)";
      popup.style.border = "1px solid var(--border-color, #444)";
      popup.style.borderRadius = "6px";
      popup.style.padding = "4px";
      popup.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      popup.style.maxHeight = "200px";
      popup.style.overflow = "auto";
      popup.style.minWidth = "200px";

      currentIndex = 0;
      updatePopup(props);

      const coords = props.editor.view.coordsAtPos(props.range.from);
      popup.style.top = `${coords.bottom + window.scrollY + 4}px`;
      popup.style.left = `${coords.left + window.scrollX}px`;

      document.body.appendChild(popup);
    },

    onUpdate: (props: PageReferenceRenderProps) => {
      updatePopup(props);
    },

    onKeyDown: (props: { event: KeyboardEvent; range: Range }) => {
      if (!popup) return false;

      if (props.event.key === "ArrowDown") {
        props.event.preventDefault();
        const items = popup.querySelectorAll(".page-reference-item");
        currentIndex = (currentIndex + 1) % items.length;
        updateActiveItem(items);
        return true;
      }

      if (props.event.key === "ArrowUp") {
        props.event.preventDefault();
        const items = popup.querySelectorAll(".page-reference-item");
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        updateActiveItem(items);
        return true;
      }

      if (props.event.key === "Enter") {
        props.event.preventDefault();
        const items = popup.querySelectorAll(".page-reference-item");
        const item = items[currentIndex];
        if (item) {
          (item as HTMLElement).click();
        }
        return true;
      }

      if (props.event.key === "Escape") {
        props.event.preventDefault();
        popup?.remove();
        popup = null;
        return true;
      }

      return false;
    },

    onExit: () => {
      popup?.remove();
      popup = null;
    },
  };

  function updatePopup(props: PageReferenceRenderProps) {
    if (!popup) return;

    popup.innerHTML = "";

    if (props.items.length === 0) {
      const el = document.createElement("div");
      el.className = "page-reference-empty";
      el.textContent = "No pages found";
      el.style.padding = "8px 12px";
      el.style.color = "var(--text-muted, #888)";
      el.style.fontSize = "13px";
      popup.appendChild(el);
      return;
    }

    props.items.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = `page-reference-item${index === currentIndex ? " active" : ""}`;
      el.textContent = item.pageTitle;
      el.style.padding = "6px 12px";
      el.style.cursor = "pointer";
      el.style.borderRadius = "4px";
      el.style.fontSize = "14px";
      el.addEventListener("click", () => {
        props.command(item);
      });
      el.addEventListener("mouseenter", () => {
        currentIndex = index;
        updateActiveItem(popup!.querySelectorAll(".page-reference-item"));
      });
      popup.appendChild(el);
    });
  }

  function updateActiveItem(items: NodeListOf<Element>) {
    items.forEach((el, i) => {
      if (i === currentIndex) {
        el.classList.add("active");
        (el as HTMLElement).style.background = "var(--accent, #4a9eff)";
        (el as HTMLElement).style.color = "#fff";
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("active");
        (el as HTMLElement).style.background = "";
        (el as HTMLElement).style.color = "";
      }
    });
  }
}