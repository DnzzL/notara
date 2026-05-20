import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { PageExport, DatabaseCsvExport, ExportAllResult } from "@notion-alt/shared";
import { pageFromRow, blockFromRow, dbFromRow, fieldFromRow, recordFromRow } from "../mappers.js";
import * as path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

// ── Block to Markdown conversion ─────────────────────────────────────────────

/**
 * Convert a block type and content to Markdown format.
 */
export function blockToMarkdown(type: string, content: string): string {
  switch (type) {
    case "heading1":
      return `# ${content}`;
    case "heading2":
      return `## ${content}`;
    case "heading3":
      return `### ${content}`;
    case "paragraph":
      return content;
    case "bulletList":
      return `- ${content}`;
    case "numberedList":
      return `1. ${content}`;
    case "todo":
      // content might start with "[ ]" or "[x]" from the database
      if (content.startsWith("[ ]") || content.startsWith("[x]") || content.startsWith("[X]")) {
        return `- ${content}`;
      }
      return `- [ ] ${content}`;
    case "code":
      return `\`\`\`\n${content}\n\`\`\``;
    case "blockquote":
      return `> ${content}`;
    case "divider":
      return "---";
    case "image":
      return `![image](${content})`;
    case "toggle":
      return `<details><summary>${content}</summary></details>`;
    case "callout":
      return `> [!NOTE]\n> ${content}`;
    default:
      return content;
  }
}

// ── CSV escaping ─────────────────────────────────────────────────────────────

/**
 * Escape a value for CSV output. Quotes values containing commas, quotes, or newlines.
 */
export function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── Filename sanitization ────────────────────────────────────────────────────

/**
 * Sanitize a string to be used as a filename.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 200);
}

// ── Export page as Markdown ──────────────────────────────────────────────────

/**
 * Export a single page as Markdown. Returns PageExport.
 */
export function exportPageAsMarkdown(pageId: string) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Fetch the page
    const pageRows = yield* sql`
      SELECT id, title, parent_id as "parentId", icon,
             cover_url as "coverUrl",
             sort_order as "sortOrder",
             is_deleted as "isDeleted",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM pages WHERE id = ${pageId} AND is_deleted = 0
    `;
    if (pageRows.length === 0) {
      return yield* Effect.fail(new Error(`Page ${pageId} not found`));
    }
    const page = pageFromRow(pageRows[0]);

    // Fetch blocks ordered by index
    const blockRows = yield* sql`
      SELECT id, page_id as "pageId", type, content,
             parent_id as "parentId", "index"
      FROM blocks WHERE page_id = ${pageId}
      ORDER BY "index" ASC
    `;
    const blocks = blockRows.map(blockFromRow);

    // Build markdown
    let markdown = `# ${page.title}\n\n`;
    for (const block of blocks) {
      const md = blockToMarkdown(block.type, block.content);
      markdown += md + "\n\n";
    }

    return new PageExport({
      pageId: page.id,
      title: page.title,
      markdown,
      databasesExported: 0,
    });
  });
}

/**
 * Export a page with all inline databases as CSV appended.
 */
export function exportPageFull(pageId: string) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Export page as markdown first
    const pageExport = yield* exportPageAsMarkdown(pageId);

    // Find inline databases on this page
    const dbRows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
      FROM databases WHERE page_id = ${pageId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;
    const databases = dbRows.map(dbFromRow);

    let combinedMarkdown = pageExport.markdown;
    let dbsExported = 0;

    for (const db of databases) {
      const csvResult = yield* exportDatabaseAsCsv(db.id);
      combinedMarkdown += `\n\n## Database: ${csvResult.name}\n\n\`\`\`csv\n${csvResult.csv}\n\`\`\``;
      dbsExported++;
    }

    return new PageExport({
      pageId: pageExport.pageId,
      title: pageExport.title,
      markdown: combinedMarkdown,
      databasesExported: dbsExported,
    });
  });
}

// ── Export database as CSV ───────────────────────────────────────────────────

/**
 * Export a database as CSV. Returns DatabaseCsvExport.
 */
export function exportDatabaseAsCsv(dbId: string) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Fetch database
    const dbRows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
      FROM databases WHERE id = ${dbId} AND is_deleted = 0
    `;
    if (dbRows.length === 0) {
      return yield* Effect.fail(new Error(`Database ${dbId} not found`));
    }
    const database = dbFromRow(dbRows[0]);

    // Fetch fields
    const fieldRows = yield* sql`
      SELECT id, database_id as "databaseId", name, type,
             options, relation_target_db_id as "relationTargetDbId"
      FROM database_fields WHERE database_id = ${dbId}
    `;
    const fields = fieldRows.map(fieldFromRow);

    // Fetch records
    const recordRows = yield* sql`
      SELECT id, database_id as "databaseId", title,
             is_deleted as "isDeleted", created_at as "createdAt"
      FROM database_records WHERE database_id = ${dbId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;
    const records = recordRows.map(recordFromRow);

    // Fetch field values
    const recordIds = records.map((r) => r.id);
    let fieldValues: Array<{ recordId: string; fieldId: string; value: string }> = [];
    if (recordIds.length > 0) {
      fieldValues = [...(yield* sql`
        SELECT record_id as "recordId", field_id as "fieldId", value
        FROM record_field_values
        WHERE record_id IN ${sql.in(recordIds)}
      `)];
    }

    // Build value lookup: recordId -> fieldId -> value
    const valueLookup = new Map<string, Map<string, string>>();
    for (const fv of fieldValues) {
      if (!valueLookup.has(fv.recordId)) {
        valueLookup.set(fv.recordId, new Map());
      }
      valueLookup.get(fv.recordId)!.set(fv.fieldId, fv.value);
    }

    // Build CSV
    const headers = ["Title", ...fields.map((f) => f.name)];
    const csvLines = [headers.map(csvEscape).join(",")];

    for (const record of records) {
      const recordValues = valueLookup.get(record.id) ?? new Map();
      const row = [
        csvEscape(record.title),
        ...fields.map((f) => csvEscape(recordValues.get(f.id) ?? "")),
      ];
      csvLines.push(row.join(","));
    }

    const csv = csvLines.join("\n");

    return new DatabaseCsvExport({
      dbId: database.id,
      name: database.name,
      csv,
    });
  });
}

// ── Export all to directory ──────────────────────────────────────────────────

/**
 * Export all pages as individual .md files and all databases as .csv files.
 */
export function exportAllToDirectory(outputDir: string) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Create output directories
    const dbDir = path.join(outputDir, "databases");
    yield* Effect.promise(() => mkdir(outputDir, { recursive: true }));
    yield* Effect.promise(() => mkdir(dbDir, { recursive: true }));

    // Fetch all pages
    const pageRows = yield* sql`
      SELECT id, title, parent_id as "parentId", icon,
             cover_url as "coverUrl",
             sort_order as "sortOrder",
             is_deleted as "isDeleted",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM pages WHERE is_deleted = 0
      ORDER BY sort_order ASC
    `;
    const pages = pageRows.map(pageFromRow);

    let pagesExported = 0;
    let databasesExported = 0;

    // Export each page
    for (const page of pages) {
      const pageExport = yield* exportPageFull(page.id);
      const filename = sanitizeFilename(page.title) + ".md";
      const filePath = path.join(outputDir, filename);
      yield* Effect.promise(() => writeFile(filePath, pageExport.markdown, "utf-8"));
      pagesExported++;
      databasesExported += pageExport.databasesExported;
    }

    // Export all databases as separate CSV files (including those in pages)
    const allDbRows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
      FROM databases WHERE is_deleted = 0
      ORDER BY sort_order ASC
    `;
    const allDatabases = allDbRows.map(dbFromRow);

    for (const db of allDatabases) {
      const csvResult = yield* exportDatabaseAsCsv(db.id);
      const filename = sanitizeFilename(db.name) + ".csv";
      const filePath = path.join(dbDir, filename);
      yield* Effect.promise(() => writeFile(filePath, csvResult.csv, "utf-8"));
      databasesExported++;
    }

    return new ExportAllResult({
      pagesExported,
      databasesExported,
      outputDir,
    });
  });
}
