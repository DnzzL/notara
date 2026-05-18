# ADR-001: File Attachments (Images + PDFs)

**Status:** Accepted
**Date:** 2026-05-18
**Scope:** Images and PDFs only (no generic file attachments)

## Context

The TODO item "8. File Attachments" requires supporting image and PDF uploads, storage, embedding, and viewing. The current codebase has a basic `"image"` block type that only handles URLs and data URLs — no actual file upload mechanism exists.

## Decisions

### 1. Scope: Images + PDFs Only

We are scoping this feature to **images** (JPG, PNG, GIF, WebP) and **PDFs** only. Generic file attachments (any MIME type) are out of scope for now. This keeps the implementation focused and allows for a clean extension path later.

### 2. Storage: Filesystem

Uploaded files are stored on the filesystem in `.data/attachments/` (alongside the SQLite database). The database stores only metadata (path, MIME type, size, page reference).

**Rationale:**
- Efficient serving and streaming (important for PDFs)
- DB stays lean
- Consistent with the existing `.data/notes.db` pattern
- Bun has native file I/O — no extra dependencies

### 3. Upload Mechanisms: All Three

Three upload paths are supported:
- **Slash command** (`/image`) — opens native file picker
- **Drag-and-drop** — drop files onto the editor area
- **Paste** — Ctrl+V from clipboard

**Rationale:** Covers all common user workflows without over-engineering any single path.

### 4. File Naming: ULID

Files are named with ULIDs (e.g., `01HQ5X2Y3Z.png`), consistent with existing block/page ID generation. They are served as static files by extending the existing static file handler.

**Rationale:** ULIDs are already used throughout the codebase. No path collision risk. Simple to implement.

### 5. Block Types: Two Separate Types

- `"image"` — for image files (JPG, PNG, GIF, WebP)
- `"pdf"` — for PDF files

**Rationale:** The renderer logic is very different for each type. Clean separation. Easy to add more types later (e.g., `"video"`).

### 6. Content Format: JSON

The block `content` field stores structured JSON:

```json
{
  "src": "/attachments/01HQ5X2Y3Z.png",
  "mimeType": "image/png",
  "width": 800,
  "height": 600,
  "caption": "My image"
}
```

**Rationale:** Simple migration path (just change the renderer). Easy to extend. No schema changes needed.

### 7. PDF Viewer: Inline Embedded

PDFs render inline using an `<iframe>` pointing to the file URL. A secondary "open in modal" action can be added later.

**Rationale:** Keeps the MVP simple. Seamless integration with page flow.

### 8. UX: Spinner → Render

Upload flow: user triggers upload → loading spinner appears in editor → file renders in place once upload completes.

**Rationale:** Immediate visual feedback. No extra steps for the user.

### 9. Image Sizing: Original + max-width: 100%

Files are stored at original dimensions and displayed at `max-width: 100%`.

**Rationale:** Simplest approach. User gets flexibility. Resize handles can be added later.

### 10. Upload Endpoint: Dedicated HTTP

File uploads go to a dedicated `POST /api/upload` endpoint accepting `multipart/form-data`, not through the RPC layer.

**Rationale:** File uploads are inherently HTTP/multipart. No base64 overhead. Consistent with the existing `/import-notion` endpoint.

### 11. Database Schema: Simple Attachments Table

```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

**Rationale:** Every uploaded file maps to exactly one block. Simple, covers everything needed. `block_id` can be added later if decoupled attachments are needed.

### 12. Upload Flow: Atomic

The HTTP upload endpoint performs all steps atomically:
1. Save file to disk
2. Insert into `attachments` table
3. Create the block (image/pdf type)
4. Return the block object

**Rationale:** Single round-trip. No orphaned files. No race conditions.

### 13. Backward Compatibility: Dual Format Support

The renderer supports both the old HTML format (`<img src="...">`) and the new JSON format. It checks if content starts with `{` to determine the format.

**Rationale:** Zero-risk migration. Existing images keep working. No data migration needed.

## Consequences

- **Positive:** Clean separation between images and PDFs. Simple storage model. No schema migrations for existing data.
- **Negative:** Two code paths for image rendering (old HTML vs new JSON) until old images are migrated or removed.
- **Future extension:** Adding generic file attachments would require a new block type or a separate "attachment" concept. The filesystem storage model supports this naturally.

## Implementation Plan

1. **Migration** — Add `attachments` table
2. **Server** — New upload endpoint (`POST /api/upload`), extend static file handler for attachments
3. **Schema** — Add `"pdf"` to Block type literal
4. **Frontend** — New PDF block renderer, update image renderer for JSON format
5. **Upload** — Slash command (already wired), drag-drop handler, paste handler
6. **Tests** — E2E tests for upload flow
