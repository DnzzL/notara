import { useEditor, EditorContent } from "@tiptap/react";
import { sharedExtensions, blockContent } from "./BlockEditor.js";
import type { Page, Block } from "@notara/shared";

interface ReadOnlyPageProps {
	page: Page;
	blocks: Block[];
}

function ReadOnlyBlock({ block }: { block: Block }) {
	// Database blocks render a muted placeholder instead of the interactive editor
	if (block.type === "database") {
		return (
			<div className="my-2 px-3 py-4 bg-surface-2 border border-border rounded-lg text-center text-text-3 text-[13px] select-none">
				🗃️ Database — read-only view not available
			</div>
		);
	}

	// All other blocks render read-only via TipTap with editable:false
	return <ReadOnlyTipTapBlock block={block} />;
}

function ReadOnlyTipTapBlock({ block }: { block: Block }) {
	const editor = useEditor({
		extensions: sharedExtensions(block.type),
		content: blockContent(block),
		editable: false,
		editorProps: {
			attributes: {
				class:
					"prose prose-sm max-w-none focus:outline-none [&_.is-editor-empty]:before:text-text-3 [&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0",
			},
		},
	});

	// Editor mounts async — return nothing until ready
	if (!editor) return null;

	return (
		<div className="relative">
			<EditorContent editor={editor} />
		</div>
	);
}

export function ReadOnlyPage({ page, blocks }: ReadOnlyPageProps) {
	const sorted = [...blocks].sort((a, b) => a.index - b.index);

	return (
		<article className="max-w-[720px] mx-auto px-6 py-12">
			<h1 className="text-[32px] font-bold text-text mb-8 leading-tight">
				{page.icon && <span className="mr-2">{page.icon}</span>}
				{page.title || "Untitled"}
			</h1>
			<div className="flex flex-col gap-1">
				{sorted.map((block) => (
					<div key={block.id}>
						<ReadOnlyBlock block={block} />
					</div>
				))}
			</div>
		</article>
	);
}
