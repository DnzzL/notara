import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationError } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ulid } from "ulidx";
import { BLOCK_COLS } from "../mappers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Go up from src/handlers/ to packages/ to repo root
const rootDir = join(__dirname, "../../../..");

const attachmentsDir = () =>
	process.env.DATA_DIR
		? join(process.env.DATA_DIR, "attachments")
		: join(rootDir, ".data", "attachments");

/** An artifact is an uploaded HTML document, shown live (ADR-013). */
const isArtifact = (fileName: string) => /\.html?$/i.test(fileName);
const ARTIFACT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The external hosts `html` loads from — scripts, stylesheets, images, fonts —
 * in order of first mention. An artifact reaches none of them; saying so when
 * it is attached is how its producer learns what to inline. Links (`<a href>`)
 * are not loads: a reader may still follow them.
 */
export const externalHosts = (html: string) => {
	const hosts: string[] = [];
	const add = (host: string) => {
		if (!hosts.includes(host)) hosts.push(host);
	};
	const REMOTE = /^\s*(?:https?:)?\/\/([^/"'\s>?#]+)/i;
	for (const [, tag, attrs] of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
		if (tag.toLowerCase() === "a") continue;
		for (const [, , value] of attrs.matchAll(
			/\b(src|href|poster|data|srcset)\s*=\s*["']?([^"'\s>]+)/gi,
		)) {
			const host = REMOTE.exec(value)?.[1];
			if (host) add(host.toLowerCase());
		}
	}
	for (const [, host] of html.matchAll(
		/(?:url\(\s*["']?|@import\s+["'])(?:https?:)?\/\/([^/"')\s]+)/gi,
	))
		add(host.toLowerCase());
	return hosts;
};

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/svg+xml",
]);
const ALLOWED_PDF_TYPE = "application/pdf";

function blockTypeForMimeType(mimeType: string): "image" | "pdf" | "file" {
	if (mimeType === ALLOWED_PDF_TYPE) return "pdf";
	if (ALLOWED_IMAGE_TYPES.has(mimeType)) return "image";
	return "file";
}

/**
 * Upload a file: save to disk, record in DB, create block, return block.
 */
export const uploadFile = (req: {
	pageId: string;
	fileName: string;
	mimeType: string;
	fileBuffer: Buffer;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const artifact = isArtifact(req.fileName);
		if (artifact && req.fileBuffer.length > ARTIFACT_MAX_BYTES)
			return yield* new ValidationError({
				message: "An artifact must be at most 5 MB",
			});
		const blockedHosts = artifact
			? externalHosts(req.fileBuffer.toString("utf-8"))
			: [];
		if (artifact) {
			const replaced = yield* replaceArtifact({ ...req, blockedHosts });
			if (replaced) return replaced;
		}

		// Generate ULID for the file
		const fileId = ulid();
		const ext = req.fileName.split(".").pop() || "bin";
		const fileName = `${fileId}.${ext}`;
		const filePath = join(attachmentsDir(), fileName);

		// Ensure attachments directory exists
		yield* Effect.promise(() => mkdir(attachmentsDir(), { recursive: true }));

		// Save file to disk
		yield* Effect.promise(() => writeFile(filePath, req.fileBuffer));

		// Insert attachment record
		const now = new Date().toISOString();
		yield* sql`
      INSERT INTO attachments (id, page_id, file_name, file_path, mime_type, size, created_at, artifact)
      VALUES (${fileId}, ${req.pageId}, ${req.fileName}, ${fileName}, ${req.mimeType}, ${req.fileBuffer.length}, ${now}, ${artifact ? 1 : 0})
    `;

		// Create the block
		const blockId = ulid();
		const blockType = artifact
			? "artifact"
			: blockTypeForMimeType(req.mimeType);

		// Get the next index for this page
		const indexRows = yield* sql<{ maxIndex: number }>`
      SELECT COALESCE(MAX("index"), -1) as maxIndex FROM blocks WHERE page_id = ${req.pageId}
    `;
		const index = indexRows[0].maxIndex + 1;

		// Content as JSON
		const content = JSON.stringify({
			src: `/attachments/${fileName}`,
			mimeType: req.mimeType,
			fileName: req.fileName,
			size: req.fileBuffer.length,
			...(artifact ? { blockedHosts, uploadedAt: now } : {}),
		});

		const _blockRows = yield* sql`
      INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
      VALUES (${blockId}, ${req.pageId}, ${blockType}, ${content}, ${index}, NULL)
      RETURNING ${sql.unsafe(BLOCK_COLS)}
    `;

		const fileUrl = `/attachments/${fileName}`;

		return {
			blockId,
			fileUrl,
			mimeType: req.mimeType,
			size: req.fileBuffer.length,
			blockedHosts,
		};
	}).pipe(
		Effect.mapError((e) => (e instanceof ValidationError ? e : String(e))),
	);

/**
 * Attaching an artifact again replaces it: the page's artifact of the same
 * file name gets the new bytes under its URL, and its block the new metadata.
 * No history. Null when the page has no such artifact yet.
 */
const replaceArtifact = (req: {
	pageId: string;
	fileName: string;
	mimeType: string;
	fileBuffer: Buffer;
	blockedHosts: string[];
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const [existing] = yield* sql<{ id: string; filePath: string }>`
      SELECT id, file_path as "filePath" FROM attachments
      WHERE page_id = ${req.pageId} AND file_name = ${req.fileName} AND artifact = 1
    `;
		if (!existing) return null;
		const fileUrl = `/attachments/${existing.filePath}`;
		const [block] = yield* sql<{ id: string }>`
      SELECT id FROM blocks
      WHERE page_id = ${req.pageId} AND type = 'artifact' AND json_extract(content, '$.src') = ${fileUrl}
    `;
		if (!block) return null;
		yield* Effect.promise(() =>
			writeFile(join(attachmentsDir(), existing.filePath), req.fileBuffer),
		);
		const now = new Date().toISOString();
		yield* sql`
      UPDATE attachments SET size = ${req.fileBuffer.length}, mime_type = ${req.mimeType},
        created_at = ${now}
      WHERE id = ${existing.id}
    `;
		const content = JSON.stringify({
			src: fileUrl,
			mimeType: req.mimeType,
			fileName: req.fileName,
			size: req.fileBuffer.length,
			blockedHosts: req.blockedHosts,
			uploadedAt: now,
		});
		yield* sql`UPDATE blocks SET content = ${content} WHERE id = ${block.id}`;
		return {
			blockId: block.id,
			fileUrl,
			mimeType: req.mimeType,
			size: req.fileBuffer.length,
			blockedHosts: req.blockedHosts,
		};
	});
