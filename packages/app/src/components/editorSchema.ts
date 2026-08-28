/**
 * The TipTap schema every block is rendered through — editing or not.
 *
 * Lifted out of BlockEditor so the public read-only renderer (NOT-43) can mount
 * the SAME set without dragging in the store, the RPC client and the presence
 * connection that BlockEditor also imports. A public page has no workspace and
 * no session; pulling those in would be dead weight at best and a request to an
 * endpoint a stranger cannot call at worst.
 *
 * Sharing the schema is not just tidiness. ProseMirror drops any markup its
 * schema does not know, so rendering stored HTML through this set is what
 * sanitises it. A second, looser set on the public path would be a second
 * sanitiser to keep in step — and the one facing the open web is the wrong one
 * to fall behind.
 */
import { Extension, InputRule } from "@tiptap/core";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { BLOCK_TYPE_CONFIG, type BlockType } from "./blockTypes.js";
import { CalloutNode } from "./CalloutExtension.js";
import {
	DetailsContent,
	DetailsNode,
	DetailsSummary,
} from "./DetailsExtension.js";
import { PageReferenceNode } from "./PageReferenceExtension.js";

/** Placeholder text shown on empty blocks, keyed by block type. */
export function placeholderForType(blockType: string): string {
	return (
		BLOCK_TYPE_CONFIG[blockType as BlockType]?.placeholder ??
		"Type '/' for commands"
	);
}

/**
 * Shared TipTap extensions — same set for every block editor.
 *
 * Exported so the public read-only renderer (NOT-43) mounts the SAME schema.
 * That is not a convenience: ProseMirror drops any markup its schema does not
 * know, so rendering stored HTML through this set is what sanitises it. A
 * second, looser set on the public path would be a second sanitiser to keep in
 * step, and the one facing the open web is the wrong one to get behind.
 */
export function sharedExtensions(blockType: string) {
	return [
		StarterKit as any,
		TaskList.configure({ HTMLAttributes: { class: "task-list" } }) as any,
		TaskItem.configure({
			nested: true,
			HTMLAttributes: { class: "task-item" },
		}) as any,
		HorizontalRule.configure({}) as any,
		Image.configure({ inline: false }) as any,
		Placeholder.configure({
			placeholder: placeholderForType(blockType),
			emptyEditorClass: "is-editor-empty",
		}) as any,
		Link.configure({
			autolink: true,
			linkOnPaste: true,
			openOnClick: false,
			HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
		}) as any,
		DetailsNode,
		DetailsContent,
		DetailsSummary,
		CalloutNode,
		PageReferenceNode,
		// Input rule: `[] ` or `[ ] ` at start of line → todo
		Extension.create({
			name: "todoInputRule",
			addInputRules() {
				return [
					new InputRule({
						find: /^(?:\[\]|\[ \])\s$/,
						handler({ range, commands }) {
							const taskHtml =
								'<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>';
							commands.insertContentAt(range, taskHtml);
						},
					}),
				];
			},
		}) as any,
		// Input rule: `[text](url)` → link mark
		Extension.create({
			name: "linkMarkInputRule",
			addInputRules() {
				return [
					new InputRule({
						find: /\[([^\]]+)\]\(([^)\s]+)\)$/,
						handler({ range, match, commands }) {
							const _start = range.from;
							const _end = range.to;
							const text = match[1];
							const url = match[2];
							// Insert HTML with the link already baked in
							commands.insertContentAt(range, `<a href="${url}">${text}</a>`);
						},
					}),
				];
			},
		}) as any,
	];
}

/** Map a block type to its default HTML content when empty. */
export function defaultContentForType(type: string): string {
	return BLOCK_TYPE_CONFIG[type as BlockType]?.defaultContent ?? "<p></p>";
}

/** Content to render for the block. Exported for the public renderer. */
export function blockContent(block: { type: string; content: string }): string {
	return block.content || defaultContentForType(block.type);
}
