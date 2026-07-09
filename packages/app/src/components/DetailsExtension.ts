import { Node, mergeAttributes, type AnyExtension } from "@tiptap/core";
import type { CommandProps } from "@tiptap/core";

export interface DetailsOptions {
  HTMLAttributes: Record<string, any>;
}

export const DetailsNode = Node.create<DetailsOptions>({
  name: "details",

  group: "block",

  content: "detailsSummary detailsContent",

  defining: true,

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element: HTMLElement) => element.getAttribute("open") !== null,
        renderHTML: (attributes: { open?: boolean }) => {
          if (!attributes.open) {
            return {};
          }
          return { open: true };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "details",
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ["details", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  // Render as a custom node view so the disclosure is actually interactive.
  // The native <details>/<summary> toggle doesn't work inside a contenteditable
  // (and never persisted to the doc), so we render an explicit chevron button:
  // clicking the chevron collapses/expands and writes `open` back to the doc,
  // while clicking the summary text still edits it (the Notion toggle UX).
  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      const dom = document.createElement("div");
      dom.className = "toggle-block";
      dom.setAttribute("data-open", node.attrs.open ? "true" : "false");

      const chevron = document.createElement("button");
      chevron.type = "button";
      chevron.className = "toggle-chevron";
      chevron.contentEditable = "false";
      chevron.setAttribute("aria-label", "Toggle section");

      const contentDOM = document.createElement("div");
      contentDOM.className = "toggle-content";

      dom.appendChild(chevron);
      dom.appendChild(contentDOM);

      const isOpen = () => dom.getAttribute("data-open") === "true";
      const apply = (open: boolean) => {
        if (typeof getPos !== "function") return;
        const pos = getPos();
        if (pos == null) return;
        const { view } = editor;
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { open }));
      };

      chevron.addEventListener("mousedown", (e) => e.preventDefault());
      chevron.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        apply(!isOpen());
      });

      return {
        dom,
        contentDOM,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== "details") return false;
          dom.setAttribute("data-open", updatedNode.attrs.open ? "true" : "false");
          return true;
        },
        ignoreMutation: (mutation: any) => {
          if (mutation.target === chevron) return true;
          if (mutation.type === "attributes" && mutation.target === dom) return true;
          return false;
        },
      };
    };
  },

  addCommands() {
    return {
      setDetails:
        () =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [
              { type: "detailsSummary", content: [{ type: "text", text: "Toggle" }] },
              { type: "detailsContent", content: [{ type: "paragraph" }] },
            ],
          });
        },
    } as any;
  },
}) as AnyExtension;

export const DetailsSummary = Node.create({
  name: "detailsSummary",

  content: "inline*",

  defining: true,

  selectable: false,

  parseHTML() {
    return [
      {
        tag: "summary",
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0];
  },
}) as AnyExtension;

export const DetailsContent = Node.create({
  name: "detailsContent",

  content: "block+",

  defining: true,

  selectable: false,

  parseHTML() {
    return [
      {
        tag: "div[data-details-content]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-details-content": true }), 0];
  },
}) as AnyExtension;
