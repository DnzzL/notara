/**
 * A shared page as a stranger sees it.
 *
 * Rendered with the SAME TipTap schema the editor uses, mounted `editable:
 * false`. That is not just consistency of appearance: ProseMirror drops any
 * markup its schema does not know, so passing stored HTML through this set is
 * what sanitises it. A bespoke renderer here would be a second sanitiser to
 * keep in step with the first, and the one facing the open web is the wrong one
 * to fall behind.
 *
 * Nothing in this file may reach the store, the RPC client or the presence
 * connection. A public reader has no workspace and no session; a call into any
 * of them is a request they cannot make, and an import of any of them is a
 * reason for the editor's whole dependency graph to load on a page that shows
 * six paragraphs.
 *
 * The server has already blanked blocks that point outside the shared page
 * (pageLink, viewReference, people, and any database the publisher can no
 * longer read). This file renders a muted placeholder in their stead — it does
 * not decide what to hide, it only says so politely. A database block whose
 * content survived redaction is rendered as a read-only table instead, using
 * the schema and rows the server already narrowed in `data.databases`.
 */
import { EditorContent, useEditor } from "@tiptap/react";
import { rewriteAttachmentUrls } from "../lib/publicAssets.js";
import { blockContent, sharedExtensions } from "./editorSchema.js";

export type PublicDatabase = {
	fields: Array<{
		id: string;
		name: string;
		type: string;
		options: string[] | null;
	}>;
	records: Array<{
		id: string;
		title: string;
		values: Record<string, unknown>;
	}>;
};

export type PublicPageData = {
	page: {
		id: string;
		title: string;
		icon: string | null;
		coverUrl: string | null;
	};
	blocks: Array<{ id: string; type: string; content: string }>;
	databases: Record<string, PublicDatabase>;
};

/** Blocks the server serves blank because they reach outside this page. */
const PLACEHOLDER_LABEL: Record<string, string> = {
	pageLink: "Linked page — not part of this shared page",
	database: "Table — not part of this shared page",
	viewReference: "View — not part of this shared page",
	people: "People",
};

/** A cell value already narrowed by the server (redacted cells arrive as
 *  `null`) — formatted for a plain read-only table. */
function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "✓" : "";
	if (Array.isArray(value)) return value.join(", ");
	return String(value);
}

function DatabaseTable({ database }: { database: PublicDatabase }) {
	return (
		<div className="my-2 overflow-x-auto">
			<table className="w-full border-collapse text-[13.5px]">
				<thead>
					<tr>
						<th className="text-left border-b border-border px-2 py-1.5 font-medium text-text-2">
							Title
						</th>
						{database.fields.map((f) => (
							<th
								key={f.id}
								className="text-left border-b border-border px-2 py-1.5 font-medium text-text-2"
							>
								{f.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{database.records.map((r) => (
						<tr key={r.id}>
							<td className="border-b border-border px-2 py-1.5 text-text">
								{r.title}
							</td>
							{database.fields.map((f) => (
								<td
									key={f.id}
									className="border-b border-border px-2 py-1.5 text-text"
								>
									{formatCellValue(r.values[f.name])}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function Placeholder({ label }: { label: string }) {
	return (
		<div className="my-2 px-3.5 py-3 border border-dashed border-border rounded text-[13px] text-text-3 select-none">
			{label}
		</div>
	);
}

/** One block, read-only, through the editor's own schema. */
function ReadOnlyBlock({
	block,
	token,
	databases,
}: {
	block: { type: string; content: string };
	token: string;
	databases: Record<string, PublicDatabase>;
}) {
	// Hooks run for every block, so the editor is created even for types that
	// render a placeholder or a table. Cheap, and far better than the
	// conditional hook the alternative would need.
	const editor = useEditor(
		{
			editable: false,
			extensions: sharedExtensions(block.type),
			content: rewriteAttachmentUrls(blockContent(block), token),
		},
		[block.content, block.type, token],
	);

	if (block.type === "database") {
		const database = databases[block.content];
		return database ? (
			<DatabaseTable database={database} />
		) : (
			<Placeholder label={PLACEHOLDER_LABEL.database as string} />
		);
	}

	const placeholder = PLACEHOLDER_LABEL[block.type];
	if (placeholder) return <Placeholder label={placeholder} />;

	if (block.type === "divider") return <hr className="my-4 border-border" />;

	if (block.type === "image" || block.type === "pdf" || block.type === "file")
		return <MediaBlock block={block} token={token} />;

	if (!editor) return null;
	return <EditorContent editor={editor} />;
}

/**
 * Image, PDF and file blocks.
 *
 * Rendered here rather than through the block-renderer registry: that registry
 * imports every renderer at module load, including the ones that reach for the
 * store. Three tags is less code than untangling that, and this is the only
 * caller that cannot afford it.
 */
function MediaBlock({
	block,
	token,
}: {
	block: { type: string; content: string };
	token: string;
}) {
	let data: { src?: string; fileName?: string } | null = null;
	try {
		data = JSON.parse(block.content.replace(/<[^>]*>/g, "").trim());
	} catch {
		data = null;
	}
	if (!data?.src) return null;

	const src = rewriteAttachmentUrls(data.src, token);
	const name = data.fileName ?? "Attachment";

	if (block.type === "image")
		return (
			<img
				src={src}
				alt={name}
				className="block-image"
				style={{ maxWidth: "100%", borderRadius: 4 }}
			/>
		);

	return (
		<a
			href={src}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-2 my-2 px-3.5 py-2.5 border border-border rounded text-[13.5px] text-text no-underline hover:bg-surface-2"
		>
			<span aria-hidden="true">{block.type === "pdf" ? "📕" : "📎"}</span>
			{name}
		</a>
	);
}

export function ReadOnlyPage({
	data,
	token,
}: {
	data: PublicPageData;
	token: string;
}) {
	const { page, blocks, databases } = data;

	return (
		<article className="max-w-[720px] mx-auto px-6 py-12">
			{page.coverUrl && (
				<img
					src={rewriteAttachmentUrls(page.coverUrl, token)}
					alt=""
					className="w-full h-[180px] object-cover rounded mb-6"
				/>
			)}
			<h1 className="[font-family:var(--font-title)] text-[34px] font-bold tracking-[-0.02em] text-text mb-6">
				{page.icon && <span className="mr-2.5">{page.icon}</span>}
				{page.title}
			</h1>
			{blocks.map((block) => (
				<ReadOnlyBlock
					key={block.id}
					block={block}
					token={token}
					databases={databases}
				/>
			))}
		</article>
	);
}
