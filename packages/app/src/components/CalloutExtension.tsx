import { type AnyExtension, mergeAttributes, Node } from "@tiptap/core";
import {
	NodeViewContent,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { EmojiPicker } from "./EmojiPicker.js";

const DEFAULT_ICON = "💡";

/** Node view: a static callout box with a clickable icon and editable text. */
function CalloutView({ node, updateAttributes }: NodeViewProps) {
	const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
		null,
	);
	const icon = node.attrs.icon || DEFAULT_ICON;

	return (
		<NodeViewWrapper className="callout-block" data-callout="">
			<button
				type="button"
				className="callout-icon"
				contentEditable={false}
				title="Change icon"
				onMouseDown={(e) => e.preventDefault()}
				onClick={(e) => {
					const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
					setAnchor({ top: r.bottom + 4, left: r.left });
				}}
			>
				{icon}
			</button>
			<NodeViewContent className="callout-text" />
			{anchor !== null &&
				createPortal(
					<EmojiPicker
						open
						anchor={anchor}
						onClose={() => setAnchor(null)}
						onSelect={(emoji) =>
							updateAttributes({ icon: emoji || DEFAULT_ICON })
						}
					/>,
					document.body,
				)}
		</NodeViewWrapper>
	);
}

/**
 * A static highlighted callout box: a pickable icon plus rich-text content.
 * Unlike the toggle (DetailsExtension), it isn't collapsible. `contentElement`
 * keeps the icon out of the node's content so the box round-trips through HTML.
 */
export const CalloutNode = Node.create({
	name: "callout",

	group: "block",

	content: "inline*",

	defining: true,

	addAttributes() {
		return {
			icon: {
				default: DEFAULT_ICON,
				parseHTML: (el: HTMLElement) =>
					el.getAttribute("data-icon") || DEFAULT_ICON,
				renderHTML: (attrs: { icon?: string }) => ({
					"data-icon": attrs.icon || DEFAULT_ICON,
				}),
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-callout]", contentElement: ".callout-text" }];
	},

	renderHTML({
		node,
		HTMLAttributes,
	}: {
		node: any;
		HTMLAttributes: Record<string, any>;
	}) {
		const icon = node.attrs.icon || DEFAULT_ICON;
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-callout": "",
				class: "callout-block",
			}),
			["span", { class: "callout-icon", contenteditable: "false" }, icon],
			["div", { class: "callout-text" }, 0],
		];
	},

	addNodeView() {
		return ReactNodeViewRenderer(CalloutView);
	},
}) as AnyExtension;
