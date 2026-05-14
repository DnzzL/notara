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
