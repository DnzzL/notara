import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SqlClient } from "@effect/sql";
import { Effect } from "effect";
import { ulid } from "ulidx";
import {
	fieldKey,
	type ImportLedger,
	openLedger,
	recordKey,
} from "./ledger.js";

// Resolve the attachments dir the same way packages/server/src/handlers/upload.ts
// does so imported images land in the same place uploads do.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "../../../..");
const ATTACHMENTS_DIR = process.env.DATA_DIR
	? path.join(process.env.DATA_DIR, "attachments")
	: path.join(ROOT_DIR, ".data", "attachments");

const IMAGE_EXT_MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
};

/**
 * Resolve `src` (as written in an imported block) to an absolute path
 * inside `exportDir`, accounting for the source file's location and
 * URL-encoded filenames Notion produces. Returns null if `src` is an
 * absolute URL (http/https/data:) or can't be resolved.
 */
function resolveImportedAsset(
	exportDir: string,
	sourceFileRel: string,
	src: string,
): string | null {
	if (/^(https?:|data:|\/)/i.test(src)) return null;
	const decoded = decodeURIComponent(src);
	const fromDir = path.dirname(path.join(exportDir, sourceFileRel));
	const abs = path.resolve(fromDir, decoded);
	// Guard against path traversal — must stay within exportDir.
	if (!abs.startsWith(path.resolve(exportDir))) return null;
	return abs;
}

/**
 * Copy a file from the export tree into the attachments dir under a fresh
 * ulid name, and return its public URL. Returns null if the source
 * doesn't exist (broken link in the export).
 */
async function copyAssetToAttachments(absPath: string): Promise<string | null> {
	try {
		const ext = path.extname(absPath).toLowerCase();
		if (!IMAGE_EXT_MIME[ext]) return null;
		await mkdir(ATTACHMENTS_DIR, { recursive: true });
		const id = ulid();
		const dest = path.join(ATTACHMENTS_DIR, `${id}${ext}`);
		await copyFile(absPath, dest);
		return `/attachments/${id}${ext}`;
	} catch {
		return null;
	}
}

export interface ParsedBlock {
	type: string;
	content: string;
}

/**
 * Parse Notion exported Markdown into block objects.
 */
export function markdownToBlocks(md: string): ParsedBlock[] {
	const lines = md.split("\n");
	const blocks: ParsedBlock[] = [];
	let skipFirstH1 = true;
	let inCode = false;
	let codeContent = "";
	let codeType = "code";

	for (const line of lines) {
		if (inCode) {
			if (line.startsWith("```")) {
				blocks.push({ type: codeType, content: codeContent });
				inCode = false;
				codeContent = "";
			} else {
				codeContent += `${line}\n`;
			}
			continue;
		}

		if (line.startsWith("# ")) {
			if (skipFirstH1) {
				skipFirstH1 = false;
				continue;
			}
			blocks.push({ type: "heading1", content: line.slice(2) });
		} else if (line.startsWith("## ")) {
			blocks.push({ type: "heading2", content: line.slice(3) });
		} else if (line.startsWith("### ")) {
			blocks.push({ type: "heading3", content: line.slice(4) });
		} else if (
			line.startsWith("- [ ] ") ||
			line.startsWith("- [x] ") ||
			line.startsWith("- [X] ")
		) {
			blocks.push({ type: "todo", content: line.slice(6) });
		} else if (line.startsWith("- ")) {
			blocks.push({ type: "bulletList", content: line.slice(2) });
		} else if (line.startsWith("```")) {
			inCode = true;
			codeContent = "";
			const lang = line.slice(3).trim();
			codeType = lang ? `code-${lang}` : "code";
		} else if (line.startsWith("> ")) {
			blocks.push({ type: "blockquote", content: line.slice(2) });
		} else if (line.trim() === "---" || line.trim() === "***") {
			blocks.push({ type: "divider", content: "" });
		} else if (line.trim() === "") {
		} else {
			// Image: standalone line like `![alt](path/to/img.png)`. Notion
			// exports images this way. The path is left relative; the importer
			// will resolve + copy + rewrite afterwards.
			const trimmed = line.trim();
			const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
			const linkMatch = trimmed.match(/^\[([^\]]*)\]\(([^)]+\.md)\)$/);
			if (imgMatch) {
				const src = imgMatch[2];
				const fileName = decodeURIComponent(src.split("/").pop() ?? "image");
				blocks.push({
					type: "image",
					content: JSON.stringify({ src, fileName }),
				});
			} else if (linkMatch) {
				// Standalone link to another .md file = Notion sub-page reference.
				// Emit a pageLink placeholder; the post-import pass resolves the
				// GUID to an actual pageId.
				const href = decodeURIComponent(linkMatch[2]);
				const guids = [...href.matchAll(/[a-f0-9]{32}/gi)].map((mm) => mm[0]);
				const targetGuid = guids[guids.length - 1] ?? null;
				if (targetGuid) {
					blocks.push({
						type: "pageLink",
						content: JSON.stringify({ __pageRef: targetGuid }),
					});
				} else {
					blocks.push({ type: "paragraph", content: line });
				}
			} else {
				blocks.push({ type: "paragraph", content: line });
			}
		}
	}

	if (inCode && codeContent) {
		blocks.push({ type: codeType, content: codeContent });
	}

	return blocks;
}

/**
 * Pull the page title out of Notion's HTML export.
 * Order of preference: `<title>` tag → first `<h1>` → filename without GUID.
 */
/** Strip Notion's trailing GUID/UUID from a title — both `Title (32hex)`
 *  and `Title 32hex` forms appear depending on which export was used. */
function stripTrailingGuid(s: string): string {
	return s.replace(/\s*\(?[a-f0-9]{32}\)?\s*$/i, "").trim();
}

export function parseHtmlTitle(
	html: string,
	fallbackFilename: string = "",
): string {
	const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
	if (titleMatch)
		return stripTrailingGuid(decodeHtmlEntities(titleMatch[1]).trim());
	const h1Match = html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/i);
	if (h1Match)
		return stripTrailingGuid(
			decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, "")).trim(),
		);
	if (fallbackFilename) {
		return stripTrailingGuid(
			path.basename(fallbackFilename, path.extname(fallbackFilename)),
		);
	}
	return "Untitled";
}

/**
 * Convert Notion's HTML export to a flat list of blocks. Lightweight
 * tag-walk that pulls out the article body (between the first `<h1>` —
 * which is the title, skipped — and end of `<body>`/`<article>`) and
 * splits on the structural tags we render: headings, lists, blockquotes,
 * code, hr, and paragraphs.
 */
export function htmlToBlocks(html: string): ParsedBlock[] {
	// Strip head + everything before/after the body so we don't pick up
	// stylesheet content as "paragraphs".
	const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
	let body = bodyMatch ? bodyMatch[1] : html;

	// Notion HTML wraps everything in <article>; the page title lives in
	// a header at the top. Drop the first <h1> if present.
	body = body.replace(/<header[\s\S]*?<\/header>/gi, "");
	body = body.replace(
		/<div[^>]*class="[^"]*\bpage-header\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
		"",
	);
	body = body.replace(/<h1[^>]*>[\s\S]+?<\/h1>/i, "");

	// Notion sticks the page icon + cover image at the top of the body and
	// also inline at the start of callouts. Without dropping them,
	// htmlToBlocks turns each into an oversized standalone image block.
	body = body.replace(
		/<img[^>]*class="[^"]*\b(icon|page-cover-image|page-header-icon|callout-emoji|callout-icon)\b[^"]*"[^>]*\/?>/gi,
		"",
	);
	body = body.replace(
		/<span[^>]*class="[^"]*\bicon\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
		"",
	);
	body = body.replace(
		/<div[^>]*class="[^"]*\b(page-header-icon|page-cover|callout-icon|page-title-icon)\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
		"",
	);
	body = body.replace(
		/<figure[^>]*class="[^"]*\b(page-cover|page-header-icon)\b[^"]*"[^>]*>[\s\S]*?<\/figure>/gi,
		"",
	);

	// Inline databases: Notion renders these as <table class="collection-content">
	// and includes a sibling <a href="DBName guid.csv"> link to the data. We
	// pair them in document order — N-th <table> ↔ N-th CSV link — so the
	// resulting database block at the table's position knows which CSV's
	// data to point at.
	const csvHrefs: string[] = [];
	const csvHrefRegex = /<a[^>]*href="([^"]+\.csv)"[^>]*>[\s\S]*?<\/a>/gi;
	let hrefMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
	while ((hrefMatch = csvHrefRegex.exec(body)) !== null) {
		csvHrefs.push(decodeURIComponent(hrefMatch[1].split("/").pop() ?? ""));
	}
	// Strip the anchors now that we've recorded them — otherwise they'd
	// show up as stray "View source" link text in the body.
	body = body.replace(csvHrefRegex, "");

	const blocks: ParsedBlock[] = [];
	let tableIdx = 0;
	const blockRegex =
		/<(h[1-3]|p|ul|ol|blockquote|pre|hr|figure|table)([^>]*)>([\s\S]*?)<\/\1>|<hr[^>]*\/?>/gi;
	let m: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
	while ((m = blockRegex.exec(body)) !== null) {
		const tag = (m[1] || "hr").toLowerCase();
		const inner = (m[3] ?? "").trim();
		if (tag === "h1" || tag === "h2" || tag === "h3") {
			const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, "")).trim();
			if (text) blocks.push({ type: `heading${tag[1]}`, content: text });
		} else if (tag === "p") {
			// Paragraphs whose ENTIRE content is a single <a href="…html"> link
			// are sub-page references in Notion exports — promote those to a
			// standalone pageLink block. Inline links within mixed text are
			// left as text.
			const trimmedInner = inner.trim();
			const standaloneLink = trimmedInner.match(
				/^<a[^>]+href="([^"]+\.html?)"[^>]*>[\s\S]*?<\/a>$/i,
			);
			if (standaloneLink) {
				const href = decodeURIComponent(standaloneLink[1]);
				const guids = findAllGuids(href);
				const targetGuid = guids[guids.length - 1] ?? null;
				if (targetGuid) {
					blocks.push({
						type: "pageLink",
						content: JSON.stringify({ __pageRef: targetGuid }),
					});
					continue;
				}
			}
			const text = trimmedInner
				.replace(/<br\s*\/?>/gi, "\n")
				.replace(/<[^>]+>/g, "")
				.trim();
			const decoded = decodeHtmlEntities(text);
			if (decoded) blocks.push({ type: "paragraph", content: decoded });
		} else if (tag === "ul" || tag === "ol") {
			const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
				.map((li) => decodeHtmlEntities(li[1].replace(/<[^>]+>/g, "").trim()))
				.filter(Boolean);
			const type = tag === "ol" ? "numberedList" : "bulletList";
			for (const item of items) blocks.push({ type, content: item });
		} else if (tag === "blockquote") {
			const text = decodeHtmlEntities(inner.replace(/<[^>]+>/g, "")).trim();
			if (text) blocks.push({ type: "blockquote", content: text });
		} else if (tag === "pre") {
			const codeMatch = inner.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
			const text = decodeHtmlEntities(
				(codeMatch ? codeMatch[1] : inner).replace(/<[^>]+>/g, ""),
			);
			blocks.push({ type: "code", content: text });
		} else if (tag === "hr") {
			blocks.push({ type: "divider", content: "" });
		} else if (tag === "figure") {
			// Notion's block-level "link to page" subpage marker:
			//   <figure class="link-to-page"><a href="…html">Title</a></figure>
			// The href points to another exported HTML file. Emit a placeholder;
			// we resolve target page id after all pages are created.
			const m2 = m[2] ?? "";
			const isPageLink = /class="[^"]*\blink-to-page\b[^"]*"/i.test(m2);
			const linkMatch = isPageLink
				? inner.match(/<a[^>]+href="([^"]+\.html?)"/i)
				: null;
			if (linkMatch) {
				const href = decodeURIComponent(linkMatch[1]);
				const guids = findAllGuids(href);
				const targetGuid = guids[guids.length - 1] ?? null;
				if (targetGuid) {
					blocks.push({
						type: "pageLink",
						content: JSON.stringify({ __pageRef: targetGuid }),
					});
				}
				continue;
			}
			const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
			if (imgMatch) {
				blocks.push({
					type: "image",
					content: JSON.stringify({
						src: imgMatch[1],
						fileName: imgMatch[1].split("/").pop() ?? "image",
					}),
				});
			}
		} else if (tag === "table") {
			// Inline database. Pair this <table> with the N-th csv link in
			// document order — that's the CSV whose data we want shown here.
			// Emits a placeholder block; the CSV importer resolves it to a
			// real database id via a post-import UPDATE pass.
			const csvHref = csvHrefs[tableIdx++];
			if (csvHref) {
				const guids = findAllGuids(csvHref);
				const csvGuid = guids[guids.length - 1] ?? null;
				if (csvGuid) {
					blocks.push({
						type: "database",
						content: JSON.stringify({ __dbRef: csvGuid }),
					});
				}
			}
		}
	}
	return blocks;
}

function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parsePageTitle(
	md: string,
	fallbackFilename: string = "",
): string {
	const match = md.match(/^# (.+)$/m);
	if (match) return stripTrailingGuid(match[1].trim());
	if (fallbackFilename) {
		return stripTrailingGuid(path.basename(fallbackFilename, ".md"));
	}
	return "Untitled";
}

/**
 * Find any 32-hex Notion GUIDs inside a path segment.
 *
 * Notion's two export formats use DIFFERENT separators around the GUID:
 *   Markdown export:  `Project (a1a2…32hex).md`     ← parens
 *   HTML/CSV export:  `Project a1a2…32hex.html`     ← preceding space, no parens
 * The previous regex only handled the parens form, so HTML/CSV exports
 * never resolved a parent and everything attached to the wrapper.
 *
 * Plain `[a-f0-9]{32}` anywhere in the string handles both safely — file
 * paths don't contain incidental 32-hex runs.
 */
function findAllGuids(s: string): string[] {
	return [...s.matchAll(/[a-f0-9]{32}/gi)].map((m) => m[0]);
}

/**
 * For an imported page file, return the path(s) of its sub-content folder
 * in the export tree. Notion's two formats name this folder differently:
 *
 *   Markdown export:  `Parent (parentGuid)/Title (titleGuid).md`
 *                     sub-content folder → `Parent (parentGuid)/Title (titleGuid)`
 *
 *   HTML export:      `Parent guid/Title titleGuid.html`
 *                     sub-content folder → `Parent guid/Title`       ← no guid!
 *
 * We register both candidate folder paths (with and without trailing guid)
 * against the page's id, so child lookups by their literal dirname find
 * the parent regardless of which export format produced the archive.
 */
/**
 * Normalized lookup keys for matching a CSV row title against a record page
 * file. Notion's exports aren't always consistent — the CSV column value may
 * have a leading emoji icon, a trailing GUID, or extra whitespace that the
 * page's H1 doesn't, or vice versa. Generating multiple variants lets the
 * lookup succeed across these mismatches without resorting to fuzzy matching.
 */
function recordTitleKeys(title: string): Set<string> {
	const keys = new Set<string>();
	const add = (s: string) => {
		const t = s.trim();
		if (t) keys.add(t.toLowerCase());
	};
	add(title);
	add(stripTrailingGuid(title));
	// Strip a leading icon (emoji + optional whitespace). Matches Notion's
	// common "📋 Task One" → "Task One" pattern.
	const noIcon = title.replace(/^\s*\p{Extended_Pictographic}+\s*/u, "");
	add(noIcon);
	add(stripTrailingGuid(noIcon));
	// Collapse internal whitespace as a last resort.
	add(title.replace(/\s+/g, " "));
	return keys;
}

function contentFolderKeys(pageFilePath: string): string[] {
	const noExt = pageFilePath.replace(/\.(md|html)$/i, "");
	const stripped = noExt
		.replace(/\s*\([a-f0-9]{32}\)$/i, "") // MD form
		.replace(/\s+[a-f0-9]{32}$/i, ""); // HTML form
	return noExt === stripped ? [noExt] : [noExt, stripped];
}

/**
 * Pull this file's own GUID out of its basename, ignoring any parent
 * folder GUIDs that appear earlier in the path. Handles both Notion
 * export formats (parens or space-separated). Used to register the
 * imported page in pageMap so children can find it as their parent.
 */
export function extractGuid(filename: string): string | null {
	const base = filename.split("/").pop() ?? filename;
	const guids = findAllGuids(base);
	return guids.length > 0 ? guids[guids.length - 1] : null;
}

/**
 * Resolve a Notion-export child file's parent by looking up the parent folder's
 * GUID against a known map. Returns the mapped page id, or null if the parent
 * folder has no GUID or the GUID isn't in the map (e.g. root-level files).
 */
export function determineParent(
	filePath: string,
	guidMap: Map<string, string>,
): string | null {
	const parts = filePath.split("/");
	if (parts.length < 2) return null;
	const parentDir = parts[parts.length - 2];
	const guid = extractGuid(parentDir);
	if (!guid) return null;
	return guidMap.get(guid) ?? null;
}

export function importNotionExport(exportDir: string) {
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const allFiles = yield* Effect.promise(() => readdirRecursive(exportDir));
		const mdFiles = allFiles
			.filter((f) => f.endsWith(".md"))
			.map((f) => path.relative(exportDir, f));
		// Notion exports as either Markdown OR HTML. When users picked HTML we
		// need to fall through to it; otherwise the import would silently
		// create just a wrapper page with nothing inside.
		const htmlFiles = allFiles
			.filter((f) => f.toLowerCase().endsWith(".html"))
			.map((f) => path.relative(exportDir, f));
		const csvFiles = allFiles
			.filter((f) => f.endsWith(".csv"))
			.map((f) => path.relative(exportDir, f));

		// Prefer MD when present (richer block fidelity), otherwise fall back
		// to HTML. Each entry is { relPath, blocks, title }.
		const useHtml = mdFiles.length === 0 && htmlFiles.length > 0;
		let sourceFiles = useHtml ? htmlFiles : mdFiles;

		// Notion HTML/MD exports include a *stub* page file for every inline
		// database alongside the CSV (same GUID, e.g. `To do 3723….html` next
		// to `To do 3723….csv`). The stub's body is just the database table
		// we strip below — so importing it produces an empty "Untitled"
		// duplicate at the same level as the real DB. Filter those stubs out
		// by GUID before we create any pages.
		const csvGuids = new Set(
			csvFiles
				.map((p) => extractGuid(p))
				.filter((g): g is string => g !== null),
		);
		if (csvGuids.size > 0) {
			sourceFiles = sourceFiles.filter((p) => {
				const guid = extractGuid(p);
				return !guid || !csvGuids.has(guid);
			});
		}

		if (sourceFiles.length === 0 && csvFiles.length === 0) {
			// Nothing to import — return zero counts rather than creating an empty wrapper page.
			return { pagesImported: 0, databasesImported: 0 };
		}

		const fileContentMap = new Map<string, string>();
		for (const relPath of sourceFiles) {
			const content = yield* Effect.promise(() =>
				readFile(path.join(exportDir, relPath), "utf-8"),
			);
			fileContentMap.set(relPath, content);
		}

		// Map each CSV to the directory path containing its record files. Notion
		// uses two distinct layouts:
		//
		//   Markdown export:  `dir/DB (dbguid).csv`
		//                     `dir/DB (dbguid)/Record (recguid).md`
		//                     → record folder = `dir/DB (dbguid)`
		//
		//   HTML export:      `dir/DB dbguid.csv`
		//                     `dir/DB/Record recguid.html`         ← no guid on folder!
		//                     → record folder = `dir/DB`
		//
		// Without supporting both, HTML exports never get their record files
		// classified, so children of those rows end up as orphan top-level pages.
		const recordFolderToCsvGuid = new Map<string, string>();
		for (const csvPath of csvFiles) {
			const guid = extractGuid(csvPath);
			if (!guid) continue;
			const csvDir = path.dirname(csvPath);
			const csvBase = path.basename(csvPath, ".csv");
			const candidates = new Set<string>([
				csvBase, // "DB dbguid" (HTML form with guid)
				stripTrailingGuid(csvBase), // "DB"        (HTML form, folder has no guid)
			]);
			for (const c of candidates) {
				if (!c) continue;
				const folder = csvDir === "." ? c : `${csvDir}/${c}`;
				recordFolderToCsvGuid.set(folder, guid);
			}
		}

		// Identify record page files: source files whose immediate parent folder
		// is a known record folder (per `recordFolderToCsvGuid`). These become
		// backing pages of their records rather than regular pages.
		const recordPageRelPaths = new Set<string>();
		// dbGuid → (lowercased record title variant → relPath)
		const recordPageByDbGuid = new Map<string, Map<string, string>>();
		for (const relPath of sourceFiles) {
			const parentDir = path.dirname(relPath);
			const dbGuid = recordFolderToCsvGuid.get(parentDir);
			if (!dbGuid) continue;
			recordPageRelPaths.add(relPath);
			if (!recordPageByDbGuid.has(dbGuid)) {
				recordPageByDbGuid.set(dbGuid, new Map());
			}
			const content = fileContentMap.get(relPath) ?? "";
			const title = useHtml
				? parseHtmlTitle(content, relPath)
				: parsePageTitle(content, relPath);
			// Filename (without extension and trailing GUID) is an alternate key
			// for cases where the CSV row title and the page H1 disagree (extra
			// whitespace, an emoji in one but not the other, etc.).
			const baseName = stripTrailingGuid(
				path.basename(relPath, path.extname(relPath)),
			);
			const variants = recordTitleKeys(title);
			for (const v of recordTitleKeys(baseName)) variants.add(v);
			const recMap = recordPageByDbGuid.get(dbGuid)!;
			for (const v of variants) if (!recMap.has(v)) recMap.set(v, relPath);
		}

		// Descendants of record pages: any file whose path passes through a folder
		// whose GUID matches a record page file's GUID. They can't be processed in
		// the regular page loop because their parent (the backing page) doesn't exist
		// yet — importCsvDatabase creates it and registers it in folderMap. A third
		// pass after the CSV loop then handles them with a correct parent lookup.
		//
		// We also include record FOLDER guids: a record can have sub-pages without
		// its own body file (so no `Record (guid).md` exists, only the folder
		// `Record (guid)/` containing children). Without folder-based detection,
		// those children fall into Pass 1 with no parent registered and end up at
		// the root.
		// dbGuid → (title variant → record folder path). Lets importCsvDatabase
		// synthesize a backing page for a row whose folder exists but whose .md
		// file is missing — without one, the row's sub-pages would be re-parented
		// to the database wrapper instead of hanging off the row itself.
		//
		// Record folders sit inside a known database record folder (e.g.
		// `dir/DB/Record/...` or `dir/DB (guid)/Record (guid)/...`). We discover
		// them by walking each sourceFile's ancestry: any directory whose parent
		// is a known record folder is itself a row folder.
		const recordFolderByDbGuid = new Map<string, Map<string, string>>();
		// path → dbGuid: every directory that is the IMMEDIATE folder for a row
		// (i.e. children of this dir are descendants of that row's backing page).
		const rowFolderToDbGuid = new Map<string, string>();
		const seenRecordFolders = new Set<string>();
		for (const relPath of sourceFiles) {
			const parts = relPath.split("/");
			// For each interior directory in the path, check whether its parent
			// is a known record folder (and therefore this dir is a row folder).
			for (let i = 2; i <= parts.length - 1; i++) {
				const folderPath = parts.slice(0, i).join("/");
				const parentPath = parts.slice(0, i - 1).join("/");
				const dbGuid = recordFolderToCsvGuid.get(parentPath);
				if (!dbGuid) continue;
				rowFolderToDbGuid.set(folderPath, dbGuid);
				if (seenRecordFolders.has(folderPath)) continue;
				seenRecordFolders.add(folderPath);
				const folderTitle = stripTrailingGuid(parts[i - 1]);
				if (!recordFolderByDbGuid.has(dbGuid)) {
					recordFolderByDbGuid.set(dbGuid, new Map());
				}
				const m = recordFolderByDbGuid.get(dbGuid)!;
				for (const v of recordTitleKeys(folderTitle)) {
					if (!m.has(v)) m.set(v, folderPath);
				}
			}
		}
		const descendantRelPaths: string[] = [];
		const descendantRelPathSet = new Set<string>();
		for (const relPath of sourceFiles) {
			if (recordPageRelPaths.has(relPath)) continue;
			const parts = relPath.split("/");
			// A descendant is any file whose path passes through a row folder.
			const isDescendant = parts.slice(0, -1).some((_, idx) => {
				const ancestorPath = parts.slice(0, idx + 1).join("/");
				return rowFolderToDbGuid.has(ancestorPath);
			});
			if (isDescendant) {
				descendantRelPaths.push(relPath);
				descendantRelPathSet.add(relPath);
			}
		}

		const _now = new Date().toISOString();

		// Two parallel indexes:
		//   pageMap  — keyed by Notion GUID (used by CSV importer for cross-refs).
		//   folderMap — keyed by the literal directory path of a child (e.g.
		//               "Private & Shared/Let's get married"). Children look up
		//               their dirname here to find their parent page id. Lets us
		//               handle both export formats without depending on whether
		//               the folder name carries a GUID.
		// Identity that outlives this run. The two maps below stay: they answer
		// "where does this export path point", which is a question about the
		// export's layout, not about what a thing is called in the database.
		const ledger = openLedger("notion");
		const pageMap = new Map<string, string>();
		const folderMap = new Map<string, string>();
		// CSV GUIDs that some imported page references inline via a <table>.
		// Pre-scanned over ALL files (regular pages, record backing pages, and
		// their sub-pages) so the inline/isolated decision in importCsvDatabase
		// is correct even for databases referenced only from a record's body
		// (e.g. an inline DB nested inside a row of another DB). Without the
		// pre-scan, those nested DBs are mis-classified as isolated and get a
		// bogus root-level wrapper page.
		const inlineCsvGuids = new Set<string>();
		for (const relPath of sourceFiles) {
			const content = fileContentMap.get(relPath) ?? "";
			const blocks = useHtml
				? htmlToBlocks(content)
				: markdownToBlocks(content);
			for (const block of blocks) {
				if (block.type !== "database") continue;
				try {
					const data = JSON.parse(block.content);
					if (data?.__dbRef) inlineCsvGuids.add(data.__dbRef);
				} catch {
					/* ignore malformed placeholder */
				}
			}
		}
		// Exclude both record pages and their descendants from the regular loop —
		// record pages are handled by importCsvDatabase, descendants in a third pass.
		const sortedFiles = [...sourceFiles]
			.filter((f) => !recordPageRelPaths.has(f) && !descendantRelPathSet.has(f))
			.sort((a, b) => a.length - b.length);

		for (const relPath of sortedFiles) {
			const content = fileContentMap.get(relPath)!;
			const title = useHtml
				? parseHtmlTitle(content, relPath)
				: parsePageTitle(content, relPath);
			const guid = extractGuid(relPath);
			const dir = path.dirname(relPath);
			const parentId = (dir && dir !== "." ? folderMap.get(dir) : null) ?? null;

			// Identity comes from the ledger, so re-importing the same export
			// updates the page it created last time instead of minting a clone.
			// A page without a Notion GUID falls back to its path in the export,
			// which is the only stable handle the format offers.
			const { id: pageId, created } = yield* ledger.resolve(
				"page",
				guid ?? `path:${relPath}`,
			);
			const pageNow = new Date().toISOString();
			if (created) {
				yield* sql`
        INSERT INTO pages (id, title, parent_id, created_at, updated_at)
        VALUES (${pageId}, ${title}, ${parentId}, ${pageNow}, ${pageNow})
      `;
			} else {
				yield* sql`
        UPDATE pages SET title = ${title}, parent_id = ${parentId},
          updated_at = ${pageNow}, is_deleted = 0, deleted_at = NULL
        WHERE id = ${pageId}
      `;
				// The export is authoritative for content. Blocks carry no stable
				// identity of their own, so they are replaced wholesale rather than
				// diffed — re-importing overwrites edits made here since last time,
				// which is what "import this export again" should mean.
				yield* sql`DELETE FROM blocks WHERE page_id = ${pageId}`;
			}

			const blocks = useHtml
				? htmlToBlocks(content)
				: markdownToBlocks(content);

			// Image blocks reference files relative to this MD/HTML file inside
			// the export. Copy each into the attachments dir under a ulid name
			// and rewrite the block's src to the public /attachments/<id> URL
			// before we persist it — otherwise the renderer hits a 404.
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks[i];
				if (
					(block.type === "image" || block.type === "pdf") &&
					block.content.startsWith("{")
				) {
					try {
						const data = JSON.parse(block.content);
						const abs = data?.src
							? resolveImportedAsset(exportDir, relPath, data.src)
							: null;
						if (abs) {
							const newUrl = yield* Effect.promise(() =>
								copyAssetToAttachments(abs),
							);
							if (newUrl) {
								blocks[i] = {
									...block,
									content: JSON.stringify({ ...data, src: newUrl }),
								};
							}
						}
					} catch {
						/* leave block untouched if anything goes wrong */
					}
				}
			}

			for (let i = 0; i < blocks.length; i++) {
				const blockId = ulid();
				yield* sql`
          INSERT INTO blocks (id, page_id, type, content, "index")
          VALUES (${blockId}, ${pageId}, ${blocks[i].type}, ${blocks[i].content}, ${i})
        `;
				// Track which CSV GUIDs were referenced inline. The CSV importer
				// uses this set to decide whether a CSV is "inline" (database
				// attaches to the parent page) or "isolated" (database gets its
				// own brand-new page).
				if (blocks[i].type === "database") {
					try {
						const data = JSON.parse(blocks[i].content);
						if (data?.__dbRef) inlineCsvGuids.add(data.__dbRef);
					} catch {
						/* ignore malformed placeholder */
					}
				}
			}

			if (guid) pageMap.set(guid, pageId);
			// Register every candidate sub-content folder path so descendants
			// (sub-pages, sibling CSVs) find this page as their parent.
			for (const key of contentFolderKeys(relPath)) {
				folderMap.set(key, pageId);
			}
		}

		// Import each CSV. Branch on whether the CSV was referenced inline by
		// some page (→ database lives on that parent) or is isolated (→ a
		// new dedicated page is created to hold the database).
		const csvGuidToDbId = new Map<string, string>();
		let importedDbCount = 0;
		// Process shallow CSVs first: a nested inline DB (CSV inside another
		// record's content folder) needs its host's backing page already in
		// folderMap so the layout-based inline check resolves correctly.
		const sortedCsvFiles = [...csvFiles].sort(
			(a, b) => a.split("/").length - b.split("/").length,
		);
		for (const csvPath of sortedCsvFiles) {
			const guid = extractGuid(csvPath);
			// Inline if either an explicit __dbRef placeholder pointed at this CSV
			// OR the CSV sits inside a folder whose page we already know about.
			// Notion's HTML export omits the <a href=".csv"> anchor next to inline
			// <table class="collection-content"> sometimes, so explicit detection
			// alone is incomplete and isolated wrappers leak into the tree.
			const csvDir = path.dirname(csvPath);
			const layoutInline = csvDir !== "." && folderMap.has(csvDir);
			const isInline =
				(guid !== null && inlineCsvGuids.has(guid)) || layoutInline;
			const recPageMap =
				(guid ? recordPageByDbGuid.get(guid) : null) ??
				new Map<string, string>();
			const recFolderMap =
				(guid ? recordFolderByDbGuid.get(guid) : null) ??
				new Map<string, string>();
			const result = yield* importCsvDatabase(
				exportDir,
				csvPath,
				folderMap,
				pageMap,
				null,
				isInline,
				recPageMap,
				fileContentMap,
				useHtml,
				recFolderMap,
				ledger,
			);
			if (result) {
				importedDbCount += 1;
				if (guid) csvGuidToDbId.set(guid, result.dbId);
			}
		}

		// Third pass: sub-pages of record backing pages. folderMap now contains
		// entries for every backing page (registered by importCsvDatabase above),
		// so parent lookups resolve correctly. Sort by path length so parents are
		// always created before their children.
		for (const relPath of descendantRelPaths.sort(
			(a, b) => a.length - b.length,
		)) {
			const content = fileContentMap.get(relPath)!;
			const title = useHtml
				? parseHtmlTitle(content, relPath)
				: parsePageTitle(content, relPath);
			const guid = extractGuid(relPath);
			const dir = path.dirname(relPath);
			// Walk up the dir tree: the immediate parent's backing page may not have
			// been created (e.g. row title in CSV didn't match the record's .md H1,
			// or there's no record .md file at all — only a folder of sub-pages).
			// Falling back to the nearest registered ancestor keeps the descendant
			// nested under the database wrapper instead of becoming a root page.
			let parentId: string | null = null;
			let cursor = dir;
			while (cursor && cursor !== ".") {
				const found = folderMap.get(cursor);
				if (found) {
					parentId = found;
					break;
				}
				cursor = path.dirname(cursor);
			}

			const { id: pageId, created } = yield* ledger.resolve(
				"page",
				guid ?? `path:${relPath}`,
			);
			const pageNow = new Date().toISOString();
			if (created) {
				yield* sql`
        INSERT INTO pages (id, title, parent_id, created_at, updated_at)
        VALUES (${pageId}, ${title}, ${parentId}, ${pageNow}, ${pageNow})
      `;
			} else {
				yield* sql`
        UPDATE pages SET title = ${title}, parent_id = ${parentId},
          updated_at = ${pageNow}, is_deleted = 0, deleted_at = NULL
        WHERE id = ${pageId}
      `;
				yield* sql`DELETE FROM blocks WHERE page_id = ${pageId}`;
			}

			const blocks = useHtml
				? htmlToBlocks(content)
				: markdownToBlocks(content);
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks[i];
				if (
					(block.type === "image" || block.type === "pdf") &&
					block.content.startsWith("{")
				) {
					try {
						const data = JSON.parse(block.content);
						const abs = data?.src
							? resolveImportedAsset(exportDir, relPath, data.src)
							: null;
						if (abs) {
							const newUrl = yield* Effect.promise(() =>
								copyAssetToAttachments(abs),
							);
							if (newUrl)
								blocks[i] = {
									...block,
									content: JSON.stringify({ ...data, src: newUrl }),
								};
						}
					} catch {
						/* leave block untouched */
					}
				}
			}
			for (let i = 0; i < blocks.length; i++) {
				yield* sql`
          INSERT INTO blocks (id, page_id, type, content, "index")
          VALUES (${ulid()}, ${pageId}, ${blocks[i].type}, ${blocks[i].content}, ${i})
        `;
			}

			if (guid) pageMap.set(guid, pageId);
			for (const key of contentFolderKeys(relPath)) {
				folderMap.set(key, pageId);
			}
		}

		// Resolve every inline-database placeholder block: swap its
		// `{ __dbRef: csvGuid }` content for the actual database id.
		// Anything we couldn't resolve (missing CSV) gets deleted so the
		// user doesn't see a broken empty block.
		const placeholders = yield* sql<{ id: string; content: string }>`
      SELECT id, content FROM blocks WHERE type = 'database' AND content LIKE '%__dbRef%'
    `;
		for (const ph of placeholders) {
			try {
				const data = JSON.parse(ph.content);
				const dbId = data?.__dbRef ? csvGuidToDbId.get(data.__dbRef) : null;
				if (dbId) {
					yield* sql`UPDATE blocks SET content = ${dbId} WHERE id = ${ph.id}`;
				} else {
					yield* sql`DELETE FROM blocks WHERE id = ${ph.id}`;
				}
			} catch {
				yield* sql`DELETE FROM blocks WHERE id = ${ph.id}`;
			}
		}

		// Same pass for pageLink placeholders: swap `{ __pageRef: guid }` for
		// the actual pageId looked up in pageMap (populated as we created
		// each imported page). Unresolvable refs are removed.
		const pagePlaceholders = yield* sql<{ id: string; content: string }>`
      SELECT id, content FROM blocks WHERE type = 'pageLink' AND content LIKE '%__pageRef%'
    `;
		for (const ph of pagePlaceholders) {
			try {
				const data = JSON.parse(ph.content);
				const pageId = data?.__pageRef ? pageMap.get(data.__pageRef) : null;
				if (pageId) {
					yield* sql`UPDATE blocks SET content = ${pageId} WHERE id = ${ph.id}`;
				} else {
					yield* sql`DELETE FROM blocks WHERE id = ${ph.id}`;
				}
			} catch {
				yield* sql`DELETE FROM blocks WHERE id = ${ph.id}`;
			}
		}

		// Prune empty leaf pages: pages with no blocks, no child pages, and no
		// databases are useless stubs (Notion often exports empty index pages for
		// folders that have no real content). Loop until stable so that a chain
		// of empty parents collapses too.
		let keepPruning = true;
		while (keepPruning) {
			const emptyLeaves = yield* sql<{ id: string }>`
        SELECT p.id FROM pages p
        WHERE NOT EXISTS (SELECT 1 FROM blocks b WHERE b.page_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM pages c WHERE c.parent_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM databases d WHERE d.page_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM database_records dr WHERE dr.page_id = p.id)
      `;
			if (emptyLeaves.length === 0) {
				keepPruning = false;
				break;
			}
			for (const { id } of emptyLeaves) {
				yield* sql`DELETE FROM pages WHERE id = ${id}`;
			}
		}

		return {
			pagesImported: sourceFiles.length - recordPageRelPaths.size,
			databasesImported: importedDbCount,
			pageMap,
		};
	});
}

function importCsvDatabase(
	exportDir: string,
	csvPath: string,
	folderMap: Map<string, string>,
	pageMap: Map<string, string>,
	fallbackParentId: string | null,
	isInline: boolean,
	recordPageMap: Map<string, string>,
	fileContentMap: Map<string, string>,
	useHtml: boolean,
	recordFolderMap: Map<string, string>,
	ledger: ImportLedger,
) {
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const csvContent = yield* Effect.promise(() =>
			readFile(path.join(exportDir, csvPath), "utf-8"),
		);

		const rows = parseCsvDocument(csvContent);
		if (rows.length < 2) return null;

		const headers = rows[0];
		const dataRows = rows.slice(1);
		const titleHeader = headers[0] ?? "Name";
		const fieldHeaders = headers.slice(1);

		const dbName = stripTrailingGuid(path.basename(csvPath, ".csv"));
		const now = new Date().toISOString();

		// Two parent strategies based on how the CSV was referenced:
		//   inline   → the database lives on the page that referenced it
		//              (an inline DB block in that page's body points back to
		//              this database id via the placeholder-resolution pass).
		//   isolated → there's no inline reference, so we create a dedicated
		//              page that holds the database (otherwise the user has
		//              no way to find or navigate to it).
		let parentId: string | null;
		if (isInline) {
			const dir = path.dirname(csvPath);
			parentId =
				(dir && dir !== "." ? folderMap.get(dir) : null) ?? fallbackParentId;
		} else {
			const folderParentId =
				(path.dirname(csvPath) && path.dirname(csvPath) !== "."
					? folderMap.get(path.dirname(csvPath))
					: null) ?? fallbackParentId;
			const { id: newPageId, created: wrapperCreated } = yield* ledger.resolve(
				"page",
				`wrapper:${csvPath}`,
			);
			if (wrapperCreated) {
				yield* sql`
        INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at)
        VALUES (${newPageId}, ${dbName}, ${folderParentId}, ${"🗃️"}, ${now}, ${now})
      `;
			} else {
				yield* sql`
        UPDATE pages SET title = ${dbName}, parent_id = ${folderParentId},
          updated_at = ${now}, is_deleted = 0, deleted_at = NULL
        WHERE id = ${newPageId}
      `;
			}
			parentId = newPageId;
			// Register the wrapper under the database folder path so descendants of
			// records whose backing page wasn't created (missing record file or
			// title mismatch) still find an ancestor in the third-pass walk-up.
			for (const key of contentFolderKeys(csvPath.replace(/\.csv$/i, ".md"))) {
				folderMap.set(key, newPageId);
			}
		}

		// The CSV's path in the export is the database's identity: stable across
		// re-exports, and the only handle Notion gives that is not the content.
		const { id: dbId, created: dbCreated } = yield* ledger.resolve(
			"database",
			csvPath,
		);

		// Imported DBs keep the title column visible and rename it to whatever
		// Notion used (e.g. "Project", "Task"). Without this the user's column
		// names from Notion would be lost on every import.
		if (dbCreated) {
			yield* sql`
      INSERT INTO databases (id, page_id, name, title_label, title_hidden)
      VALUES (${dbId}, ${parentId}, ${dbName}, ${titleHeader}, 0)
    `;
		} else {
			yield* sql`
      UPDATE databases SET page_id = ${parentId}, name = ${dbName},
        title_label = ${titleHeader}, is_deleted = 0, deleted_at = NULL
      WHERE id = ${dbId}
    `;
		}

		// Scan each column to decide whether to promote it to a select/
		// multiSelect (small set of repeated values) or keep it as the inferred
		// type. Notion's "Status"/"Tag" exports come through as comma-joined
		// strings — split into multiSelect when we detect that.
		const fieldMap = new Map<string, string>();
		for (let col = 0; col < fieldHeaders.length; col++) {
			const header = fieldHeaders[col];
			const values = dataRows
				.map((r) => (r[col + 1] ?? "").trim())
				.filter(Boolean);
			const { type, options } = inferFieldFromValues(header, values);

			// Keyed by header within the database: a CSV export carries no
			// per-column id. A renamed column therefore reads as a new one.
			const { id: fieldId, created: fieldCreated } = yield* ledger.resolve(
				"field",
				fieldKey(dbId, header),
			);
			const optionsJson = options ? JSON.stringify(options) : null;
			if (fieldCreated) {
				yield* sql`
        INSERT INTO database_fields (id, database_id, name, type, options)
        VALUES (${fieldId}, ${dbId}, ${header}, ${type}, ${optionsJson})
      `;
			} else {
				yield* sql`
        UPDATE database_fields SET type = ${type}, options = ${optionsJson}
        WHERE id = ${fieldId}
      `;
			}
			fieldMap.set(header, fieldId);
		}

		for (const row of dataRows) {
			const recordTitle = row[0] || "Untitled";
			// Keyed by title within the database, for the same reason as fields.
			const { id: recordId, created: recordCreated } = yield* ledger.resolve(
				"record",
				recordKey(dbId, recordTitle),
			);
			if (recordCreated) {
				yield* sql`
        INSERT INTO database_records (id, database_id, title, created_at)
        VALUES (${recordId}, ${dbId}, ${recordTitle}, ${now})
      `;
			} else {
				yield* sql`
        UPDATE database_records SET is_deleted = 0, deleted_at = NULL
        WHERE id = ${recordId}
      `;
				// Cell values are replaced rather than merged: the export is
				// authoritative for what a re-import means.
				yield* sql`DELETE FROM record_field_values WHERE record_id = ${recordId}`;
			}

			// If the export included a per-record sub-page, create a backing page
			// for this record now (mirroring what openRecordAsPage does lazily) so
			// the imported content is immediately accessible. Parent is the same
			// host page that owns the database — consistent with the live behaviour.
			let recPageRelPath: string | undefined;
			for (const key of recordTitleKeys(recordTitle)) {
				recPageRelPath = recordPageMap.get(key);
				if (recPageRelPath) break;
			}
			let hasRecFolder = false;
			for (const key of recordTitleKeys(recordTitle)) {
				if (recordFolderMap.has(key)) {
					hasRecFolder = true;
					break;
				}
			}
			// Skip empty backing pages: Notion exports a per-row file even when
			// the row has no body. Creating one here produces a content-less page
			// that the UI's openRecordAsPage will re-create lazily anyway, so it's
			// pure clutter. Only keep the file path when there's something to
			// store (body content) or somewhere children need to anchor (folder).
			if (recPageRelPath) {
				const peekContent = fileContentMap.get(recPageRelPath) ?? "";
				const peekBlocks = useHtml
					? htmlToBlocks(peekContent)
					: markdownToBlocks(peekContent);
				if (peekBlocks.length === 0 && !hasRecFolder)
					recPageRelPath = undefined;
			}
			if (recPageRelPath) {
				const recPageContent = fileContentMap.get(recPageRelPath) ?? "";
				const recBlocks = useHtml
					? htmlToBlocks(recPageContent)
					: markdownToBlocks(recPageContent);
				const { id: recPageId, created: recPageCreated } =
					yield* ledger.resolve("page", `record:${recPageRelPath}`);
				if (recPageCreated) {
					yield* sql`
          INSERT INTO pages (id, title, parent_id, created_at, updated_at)
          VALUES (${recPageId}, ${recordTitle}, ${parentId}, ${now}, ${now})
        `;
				} else {
					yield* sql`
          UPDATE pages SET title = ${recordTitle}, parent_id = ${parentId},
            updated_at = ${now}, is_deleted = 0, deleted_at = NULL
          WHERE id = ${recPageId}
        `;
					yield* sql`DELETE FROM blocks WHERE page_id = ${recPageId}`;
				}
				yield* sql`UPDATE database_records SET page_id = ${recPageId} WHERE id = ${recordId}`;
				// Register in pageMap so pageLink blocks in other pages that reference
				// this record page by GUID resolve correctly in the placeholder pass.
				const recPageGuid = extractGuid(recPageRelPath);
				if (recPageGuid) pageMap.set(recPageGuid, recPageId);
				// Register the backing page's folder in folderMap so that any
				// sub-pages nested inside this record's export folder can find it
				// as their parent in the third-pass import.
				for (const key of contentFolderKeys(recPageRelPath)) {
					folderMap.set(key, recPageId);
				}
				for (let i = 0; i < recBlocks.length; i++) {
					const block = recBlocks[i];
					// Copy local image/pdf assets into the attachments dir, same as the
					// regular page import loop.
					let finalBlock = block;
					if (
						(block.type === "image" || block.type === "pdf") &&
						block.content.startsWith("{")
					) {
						try {
							const data = JSON.parse(block.content);
							const abs = data?.src
								? resolveImportedAsset(exportDir, recPageRelPath, data.src)
								: null;
							if (abs) {
								const newUrl = yield* Effect.promise(() =>
									copyAssetToAttachments(abs),
								);
								if (newUrl)
									finalBlock = {
										...block,
										content: JSON.stringify({ ...data, src: newUrl }),
									};
							}
						} catch {
							/* leave block untouched */
						}
					}
					yield* sql`
            INSERT INTO blocks (id, page_id, type, content, "index")
            VALUES (${ulid()}, ${recPageId}, ${finalBlock.type}, ${finalBlock.content}, ${i})
          `;
				}
			} else {
				// No record .md file matched, but the row may still have a folder
				// of sub-pages (e.g. an empty-body row whose only content is nested
				// pages). Create a backing page so its children hang off the row
				// itself rather than getting re-parented to the database wrapper.
				let recFolderPath: string | undefined;
				for (const key of recordTitleKeys(recordTitle)) {
					recFolderPath = recordFolderMap.get(key);
					if (recFolderPath) break;
				}
				if (recFolderPath) {
					const { id: recPageId, created: folderPageCreated } =
						yield* ledger.resolve("page", `recordFolder:${recFolderPath}`);
					if (folderPageCreated) {
						yield* sql`
            INSERT INTO pages (id, title, parent_id, created_at, updated_at)
            VALUES (${recPageId}, ${recordTitle}, ${parentId}, ${now}, ${now})
          `;
					} else {
						yield* sql`
            UPDATE pages SET title = ${recordTitle}, parent_id = ${parentId},
              updated_at = ${now}, is_deleted = 0, deleted_at = NULL
            WHERE id = ${recPageId}
          `;
					}
					yield* sql`UPDATE database_records SET page_id = ${recPageId} WHERE id = ${recordId}`;
					folderMap.set(recFolderPath, recPageId);
					const stripped = recFolderPath
						.replace(/\s*\([a-f0-9]{32}\)$/i, "")
						.replace(/\s+[a-f0-9]{32}$/i, "");
					if (stripped !== recFolderPath) folderMap.set(stripped, recPageId);
				}
			}

			for (let j = 0; j < fieldHeaders.length; j++) {
				const fieldId = fieldMap.get(fieldHeaders[j]);
				const raw = (row[j + 1] ?? "").trim();
				if (!fieldId || !raw) continue;

				// Match what the frontend expects per type:
				//   multiSelect → JSON array of strings
				//   checkbox    → "true"/"false"
				//   number      → numeric string
				//   everything else → raw string
				let stored = raw;
				// Pull the type back out to re-encode multiSelect values.
				const fieldType = inferFieldFromValues(
					fieldHeaders[j],
					dataRows.map((r) => (r[j + 1] ?? "").trim()).filter(Boolean),
				).type;
				if (fieldType === "multiSelect") {
					stored = JSON.stringify(
						raw
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean),
					);
				} else if (fieldType === "checkbox") {
					stored = /^(yes|true|1|on|✓|x|done)$/i.test(raw) ? "true" : "false";
				}

				yield* sql`
          INSERT INTO record_field_values (id, record_id, field_id, value)
          VALUES (${ulid()}, ${recordId}, ${fieldId}, ${stored})
        `;
			}
		}

		return { dbId, dbName, recordCount: dataRows.length };
	});
}

/**
 * Parse a full CSV document (handles quoted cells and newlines inside
 * quotes). Returns rows of cells.
 */
function parseCsvDocument(text: string): string[][] {
	const rows: string[][] = [];
	let cur = "";
	let row: string[] = [];
	let inQuotes = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"' && text[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (c === '"') inQuotes = false;
			else cur += c;
		} else {
			if (c === '"') inQuotes = true;
			else if (c === ",") {
				row.push(cur);
				cur = "";
			} else if (c === "\n" || c === "\r") {
				if (cur !== "" || row.length > 0) {
					row.push(cur);
					rows.push(row);
				}
				cur = "";
				row = [];
				if (c === "\r" && text[i + 1] === "\n") i++;
			} else cur += c;
		}
	}
	if (cur !== "" || row.length > 0) {
		row.push(cur);
		rows.push(row);
	}
	return rows;
}

/**
 * Decide a column's field type from its header and values.
 * - small set of repeated single tokens → select
 * - values containing commas with small overall vocabulary → multiSelect
 * - numeric-looking → number
 * - "yes/no" / "true/false" → checkbox
 * - date-shaped → date
 * - fallback → text
 */
function inferFieldFromValues(
	header: string,
	values: string[],
): { type: string; options: string[] | null } {
	if (values.length === 0)
		return { type: inferFieldType(header), options: null };

	// Boolean-ish?
	const boolLike = values.every((v) =>
		/^(yes|no|true|false|0|1|on|off|✓|x|done|todo)$/i.test(v),
	);
	if (boolLike) return { type: "checkbox", options: null };

	// Number-ish?
	const numericLike = values.every(
		(v) => v === "" || /^-?\d+(\.\d+)?$/.test(v.replace(/,/g, "")),
	);
	if (numericLike) return { type: "number", options: null };

	// Date-ish? (ISO or "Mon DD, YYYY")
	const dateLike = values.every((v) => !Number.isNaN(Date.parse(v)));
	if (dateLike && values.length > 0) return { type: "date", options: null };

	// Comma-joined values → multiSelect if the overall vocabulary is small
	const hasCommas = values.some((v) => v.includes(","));
	const tokens = hasCommas
		? values.flatMap((v) =>
				v
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
			)
		: values;
	const unique = Array.from(new Set(tokens));
	if (unique.length > 0 && unique.length <= Math.max(12, values.length / 2)) {
		return { type: hasCommas ? "multiSelect" : "select", options: unique };
	}

	return { type: inferFieldType(header), options: null };
}

function _parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ",") {
				result.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}
	}
	result.push(current.trim());
	return result;
}

function inferFieldType(header: string): string {
	const lower = header.toLowerCase();
	if (
		lower.includes("select") ||
		lower.includes("status") ||
		lower.includes("tag")
	)
		return "select";
	if (lower.includes("multi") || lower.includes("tags")) return "multiSelect";
	if (
		lower.includes("number") ||
		lower.includes("price") ||
		lower.includes("amount")
	)
		return "number";
	if (lower.includes("date") || lower.includes("time")) return "date";
	if (
		lower.includes("check") ||
		lower.includes("done") ||
		lower.includes("complete")
	)
		return "checkbox";
	return "text";
}

async function readdirRecursive(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await readdirRecursive(fullPath)));
		} else {
			files.push(fullPath);
		}
	}

	return files;
}
