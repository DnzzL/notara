import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { ulid } from "ulidx";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
        codeContent += line + "\n";
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
    } else if (line.startsWith("- [ ] ") || line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
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
      continue;
    } else {
      blocks.push({ type: "paragraph", content: line });
    }
  }

  if (inCode && codeContent) {
    blocks.push({ type: codeType, content: codeContent });
  }

  return blocks;
}

export function parsePageTitle(md: string, fallbackFilename: string = ""): string {
  const match = md.match(/^# (.+)$/m);
  if (match) return match[1].trim();
  if (fallbackFilename) {
    return path.basename(fallbackFilename, ".md").replace(/\s*\([a-f0-9]{32}\)$/, "").trim();
  }
  return "Untitled";
}

export function determineParent(
  filePath: string,
  pageMap: Map<string, string>
): string | null {
  const folderMatch = filePath.match(/\((\w{32})\)\//);
  if (!folderMatch) return null;
  const parentGuid = folderMatch[1];
  return pageMap.get(parentGuid) || null;
}

export function extractGuid(filename: string): string | null {
  const match = filename.match(/\(([a-f0-9]{32})\)/i);
  return match ? match[1] : null;
}

export function importNotionExport(exportDir: string) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const allFiles = yield* Effect.promise(() =>
      readdirRecursive(exportDir)
    );

    const mdFiles = allFiles
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.relative(exportDir, f));

    const csvFiles = allFiles
      .filter((f) => f.endsWith(".csv"))
      .map((f) => path.relative(exportDir, f));

    const guidToFilePath = new Map<string, string>();
    const fileContentMap = new Map<string, string>();

    for (const relPath of mdFiles) {
      const content = yield* Effect.promise(() =>
        readFile(path.join(exportDir, relPath), "utf-8")
      );
      fileContentMap.set(relPath, content);

      const guid = extractGuid(relPath);
      if (guid) {
        guidToFilePath.set(guid, relPath);
      }
    }

    const pageMap = new Map<string, string>();
    const sortedFiles = [...mdFiles].sort((a, b) => a.length - b.length);

    for (const relPath of sortedFiles) {
      const content = fileContentMap.get(relPath)!;
      const title = parsePageTitle(content, relPath);
      const guid = extractGuid(relPath);
      const parentId = determineParent(relPath, pageMap);

      const pageId = ulid();
      const now = new Date().toISOString();

      yield* sql`
        INSERT INTO pages (id, title, parent_id, created_at, updated_at)
        VALUES (${pageId}, ${title}, ${parentId}, ${now}, ${now})
      `;

      const blocks = markdownToBlocks(content);
      for (let i = 0; i < blocks.length; i++) {
        const blockId = ulid();
      yield* sql`
        INSERT INTO blocks (id, page_id, type, content, "index")
        VALUES (${blockId}, ${pageId}, ${blocks[i].type},
                ${blocks[i].content}, ${i})
      `;
      }

      if (guid) {
        pageMap.set(guid, pageId);
      }
    }

    const importedDbs = yield* Effect.all(
      csvFiles.map((csvPath) => importCsvDatabase(exportDir, csvPath, pageMap))
    );

    return {
      pagesImported: mdFiles.length,
      databasesImported: importedDbs.filter(Boolean).length,
      pageMap,
    };
  });
}

function importCsvDatabase(
  exportDir: string,
  csvPath: string,
  pageMap: Map<string, string>
) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const csvContent = yield* Effect.promise(() =>
      readFile(path.join(exportDir, csvPath), "utf-8")
    );

    const lines = csvContent.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return null;

    const headers = parseCsvLine(lines[0]);
    const fieldHeaders = headers.slice(1);

    const parentGuid = extractGuidFromPath(csvPath);
    const parentId = parentGuid ? pageMap.get(parentGuid) : null;

    if (!parentId) {
      console.warn(`[import] Cannot find parent for database: ${csvPath}`);
      return null;
    }

    const dbName = path.basename(csvPath, ".csv").replace(/\s*\([a-f0-9]{32}\)$/, "");
    const dbId = ulid();
    const now = new Date().toISOString();

    yield* sql`
      INSERT INTO databases (id, page_id, name)
      VALUES (${dbId}, ${parentId}, ${dbName})
    `;

    const fieldMap = new Map<string, string>();
    for (const header of fieldHeaders) {
      const fieldId = ulid();
      const fieldType = inferFieldType(header);
      yield* sql`
        INSERT INTO database_fields (id, database_id, name, type)
        VALUES (${fieldId}, ${dbId}, ${header}, ${fieldType})
      `;
      fieldMap.set(header, fieldId);
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const recordTitle = values[0] || "Untitled";
      const recordId = ulid();

      yield* sql`
        INSERT INTO database_records (id, database_id, title, created_at)
        VALUES (${recordId}, ${dbId}, ${recordTitle}, ${now})
      `;

      for (let j = 1; j < values.length && j - 1 < fieldHeaders.length; j++) {
        const fieldId = fieldMap.get(fieldHeaders[j - 1]);
        if (fieldId && values[j]) {
          yield* sql`
            INSERT INTO record_field_values (id, record_id, field_id, value)
            VALUES (${ulid()}, ${recordId}, ${fieldId}, ${values[j]})
          `;
        }
      }
    }

    return { dbId, dbName, recordCount: lines.length - 1 };
  });
}

function parseCsvLine(line: string): string[] {
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
  if (lower.includes("select") || lower.includes("status") || lower.includes("tag")) return "select";
  if (lower.includes("multi") || lower.includes("tags")) return "multiSelect";
  if (lower.includes("number") || lower.includes("price") || lower.includes("amount")) return "number";
  if (lower.includes("date") || lower.includes("time")) return "date";
  if (lower.includes("check") || lower.includes("done") || lower.includes("complete")) return "checkbox";
  return "text";
}

function extractGuidFromPath(filePath: string): string | null {
  const match = filePath.match(/\(([a-f0-9]{32})\)/i);
  return match ? match[1] : null;
}

async function readdirRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readdirRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
