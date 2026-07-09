# Spec: Import/Export Feature (TODO.md Section 6)

## Overview
Implement import/export functionality for the Notara application. This includes:
- Import Notion Markdown exports
- Import Notion CSV databases
- Export page as Markdown
- Export database as CSV
- Export all pages as a directory structure (for ZIP)

## Architecture
- Import logic: `packages/server/src/import/notion.ts` (already partially exists)
- Export logic: `packages/server/src/export/page.ts` (new)
- RPC handlers: `packages/server/src/handlers/importExport.ts` (new)
- RPC schemas: `packages/shared/src/schema.ts` (extend)
- RPC endpoints: `packages/shared/src/api.ts` (extend)
- Server wiring: `packages/server/src/index.ts` (extend)

---

## Task 1: Extend Shared Schemas

**Depends on:** (none - foundation)

### Modify: packages/shared/src/schema.ts

Add the following schema classes at the end of the file (after SearchResult):

```typescript
/** Result of exporting a page as Markdown. */
export class PageExport extends Schema.Class<PageExport>("PageExport")({
  pageId: Schema.String,
  title: Schema.String,
  markdown: Schema.String,
  databasesExported: Schema.Number,
}) {}

/** Result of exporting a database as CSV. */
export class DatabaseCsvExport extends Schema.Class<DatabaseCsvExport>("DatabaseCsvExport")({
  dbId: Schema.String,
  name: Schema.String,
  csv: Schema.String,
}) {}

/** Result of importing from a directory. */
export class ImportResult extends Schema.Class<ImportResult>("ImportResult")({
  pagesImported: Schema.Number,
  databasesImported: Schema.Number,
}) {}

/** Result of exporting all pages to a directory. */
export class ExportAllResult extends Schema.Class<ExportAllResult>("ExportAllResult")({
  pagesExported: Schema.Number,
  databasesExported: Schema.Number,
  outputDir: Schema.String,
}) {}
```

### Modify: packages/shared/src/api.ts

Add imports at the top (extend existing import block):
```typescript
import {
  // ... existing imports ...
  PageExport,
  DatabaseCsvExport,
  ImportResult,
  ExportAllResult,
} from "./schema.js";
```

Add RPC endpoints before the closing `);` of `RpcGroup.make`:
```typescript
  // Import/Export
  Rpc.make("importNotion", {
    payload: { directory: Schema.String },
    success: ImportResult,
  }),
  Rpc.make("exportPage", {
    payload: { pageId: Schema.String, includeDatabases: Schema.Boolean },
    success: PageExport,
  }),
  Rpc.make("exportDatabase", {
    payload: { dbId: Schema.String },
    success: DatabaseCsvExport,
  }),
  Rpc.make("exportAll", {
    payload: { outputDir: Schema.String },
    success: ExportAllResult,
  }),
```

---

## Task 2: Create Export Module

**Depends on:** (can run in parallel with Task 1)

### Create: packages/server/src/export/page.ts

Create the export module with these functions:

1. `blockToMarkdown(type: string, content: string): string`
   - Convert block types to Markdown
   - Handle: headings, paragraphs, lists, todos, code blocks, blockquotes, dividers, images, toggles, callouts

2. `exportPageAsMarkdown(pageId: string): Effect<...>`
   - Fetch page from DB
   - Fetch blocks ordered by index
   - Convert each block to Markdown
   - Return PageExportResult

3. `exportPageFull(pageId: string): Effect<...>`
   - Export page as Markdown
   - Also export all inline databases as CSV
   - Combine into single output

4. `exportDatabaseAsCsv(dbId: string): Effect<...>`
   - Fetch database, fields, records
   - Fetch field values
   - Build CSV with proper escaping
   - Return DatabaseCsvExport

5. `exportAllToDirectory(outputDir: string): Effect<...>`
   - Export all pages as individual .md files
   - Export all databases as .csv files in databases/ subdirectory
   - Return count summary

> Key: Use Effect.gen() with yield* for all async operations
> Use SqlClient.SqlClient for database access
> CSV escaping: quote values containing commas, quotes, or newlines

---

## Task 3: Create Import/Export Handler

**Depends on:** Task 1, Task 2

### Create: packages/server/src/handlers/importExport.ts

Create handler functions that wire up the import/export logic:

```typescript
import { Effect } from "effect";
import * as Import from "../import/notion.js";
import * as Export from "../export/page.js";

export function importNotion(directory: string) {
  // Call Import.importNotionExport(directory)
  // Map result to ImportResult shape
}

export function exportPage(pageId: string, includeDatabases: boolean) {
  // If includeDatabases: Export.exportPageFull
  // Else: Export.exportPageAsMarkdown
}

export function exportDatabase(dbId: string) {
  // Call Export.exportDatabaseAsCsv
}

export function exportAll(outputDir: string) {
  // Call Export.exportAllToDirectory
}
```

> Import the existing import/notion.ts module
> Map return types to match the RPC schema shapes

---

## Task 4: Wire Up Server

**Depends on:** Task 1, Task 3

### Modify: packages/server/src/index.ts

Add import at the top:
```typescript
import * as ImportExport from "./handlers/importExport.js";
```

Add to `rpcHandlersLayer` (before the closing `});`):
```typescript
  // Import/Export
  importNotion: ({ directory }) => ImportExport.importNotion(directory).pipe(Effect.orDie),
  exportPage: ({ pageId, includeDatabases }) => 
    ImportExport.exportPage(pageId, includeDatabases).pipe(Effect.orDie),
  exportDatabase: ({ dbId }) => ImportExport.exportDatabase(dbId).pipe(Effect.orDie),
  exportAll: ({ outputDir }) => ImportExport.exportAll(outputDir).pipe(Effect.orDie),
```

> The server uses Effect.orDie to convert errors to defects for the RPC layer

---

## Task 5: Add Tests

**Depends on:** Task 2, Task 3

### Create: packages/server/test/export.test.ts

Test the export functions:

1. `blockToMarkdown` - test each block type conversion
2. `csvEscape` - test CSV escaping edge cases
3. `sanitizeFilename` - test filename sanitization

### Create: packages/server/test/importExport.test.ts

Integration tests (mock SQL):

1. `exportPageAsMarkdown` - verify markdown output format
2. `exportDatabaseAsCsv` - verify CSV output format
3. `importNotion` - verify import with mock directory structure

> Use bun:test framework
> Mock SQL responses using Effect's test utilities

---

## Verification Checklist

After completing all tasks:
1. `npx tsc --noEmit 2>&1 | grep "src/"` - should show no new errors
2. `bun test packages/server/test/export.test.ts` - export tests pass
3. `bun test packages/server/test/importExport.test.ts` - integration tests pass
4. Import a Notion export directory - pages and databases imported
5. Export a page - markdown file generated with correct formatting
6. Export a database - CSV file with headers and data rows
7. Export all - directory with .md and .csv files
