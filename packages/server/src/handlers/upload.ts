import { Effect, Layer } from "effect";
import { SqlClient } from "@effect/sql";
import { ulid } from "ulidx";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BLOCK_COLS } from "../mappers.js";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Go up from src/handlers/ to packages/ to repo root
const rootDir = join(__dirname, "../../../..");

const ATTACHMENTS_DIR = (() => {
  const dataDir = process.env.DATA_DIR
    ? join(process.env.DATA_DIR, "attachments")
    : join(rootDir, ".data", "attachments");
  return dataDir;
})();

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
]);
const ALLOWED_PDF_TYPE = "application/pdf";

function isAllowedType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(mimeType) || mimeType === ALLOWED_PDF_TYPE;
}

function blockTypeForMimeType(mimeType: string): "image" | "pdf" {
  return mimeType === ALLOWED_PDF_TYPE ? "pdf" : "image";
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

    // Validate MIME type
    if (!isAllowedType(req.mimeType)) {
      return yield* Effect.fail(
        `Unsupported file type: ${req.mimeType}. Allowed: images and PDFs only.`
      );
    }

    // Generate ULID for the file
    const fileId = ulid();
    const ext = req.fileName.split(".").pop() || "bin";
    const fileName = `${fileId}.${ext}`;
    const filePath = join(ATTACHMENTS_DIR, fileName);

    // Ensure attachments directory exists
    yield* Effect.promise(() => mkdir(ATTACHMENTS_DIR, { recursive: true }));

    // Save file to disk
    yield* Effect.promise(() => writeFile(filePath, req.fileBuffer));

    // Insert attachment record
    const now = new Date().toISOString();
    yield* sql`
      INSERT INTO attachments (id, page_id, file_name, file_path, mime_type, size, created_at)
      VALUES (${fileId}, ${req.pageId}, ${req.fileName}, ${fileName}, ${req.mimeType}, ${req.fileBuffer.length}, ${now})
    `;

    // Create the block
    const blockId = ulid();
    const blockType = blockTypeForMimeType(req.mimeType);

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
    });

    const blockRows = yield* sql`
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
    };
  }).pipe(Effect.mapError(String));
