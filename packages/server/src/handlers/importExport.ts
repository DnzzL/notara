import { Effect } from "effect";
import { ImportResult, PageExport, DatabaseCsvExport } from "@notion-alt/shared";
import * as Import from "../import/notion.js";
import * as Export from "../export/page.js";
import { mkdir, rm, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";

export function importNotion(directory: string) {
  return Import.importNotionExport(directory).pipe(
    Effect.map((result) =>
      new ImportResult({
        pagesImported: result.pagesImported,
        databasesImported: result.databasesImported,
      })
    )
  );
}

export function exportPage(pageId: string, includeDatabases: boolean) {
  if (includeDatabases) {
    return Export.exportPageFull(pageId);
  }
  return Export.exportPageAsMarkdown(pageId);
}

export function exportDatabase(dbId: string) {
  return Export.exportDatabaseAsCsv(dbId);
}

export function exportAll(outputDir: string) {
  return Export.exportAllToDirectory(outputDir);
}

/**
 * Extract a zip from a file path into `dest` using `adm-zip`.
 * Pure JS so it isn't affected by the host's locale — `unzip(1)` chokes
 * with "Illegal byte sequence" on non-ASCII filenames (e.g. curly
 * apostrophes) when LANG/LC_ALL isn't a UTF-8 locale, which is the
 * default on many macOS setups.
 */
function extractZip(zipPath: string, dest: string): void {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, /* overwrite */ true);
}

/**
 * Recursively unzip any `.zip` files found inside `dir`. Notion's full
 * workspace export wraps content in nested zips (one outer + one inner),
 * so a single pass would leave the actual pages still archived.
 *
 * Each nested zip is extracted into a folder next to itself and then
 * removed. Repeats until no `.zip` files remain.
 */
async function unwrapNestedZips(dir: string, depth = 0): Promise<void> {
  if (depth > 4) return; // safety cap
  const entries = await readdir(dir, { withFileTypes: true });
  let found = false;
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await unwrapNestedZips(full, depth + 1);
    } else if (entry.name.toLowerCase().endsWith(".zip")) {
      const innerDir = full.replace(/\.zip$/i, "");
      await mkdir(innerDir, { recursive: true });
      extractZip(full, innerDir);
      await unlink(full);
      found = true;
    }
  }
  if (found) await unwrapNestedZips(dir, depth + 1);
}

/**
 * Import from a ZIP file buffer. Extracts to temp dir, runs import, cleans up.
 * Handles Notion's nested-zip-in-zip export structure.
 */
export function importNotionZip(zipBuffer: Buffer, filename: string) {
  return Effect.gen(function* () {
    const tmpBase = join(tmpdir(), `notion-import-${Date.now()}`);
    const zipPath = join(tmpBase, filename);
    const extractDir = join(tmpBase, "extracted");

    try {
      yield* Effect.promise(() => mkdir(tmpBase, { recursive: true }));
      yield* Effect.promise(() => writeFile(zipPath, zipBuffer));
      yield* Effect.promise(() => mkdir(extractDir, { recursive: true }));
      yield* Effect.sync(() => extractZip(zipPath, extractDir));
      yield* Effect.promise(() => unwrapNestedZips(extractDir));

      const result = yield* Import.importNotionExport(extractDir);
      return new ImportResult({
        pagesImported: result.pagesImported,
        databasesImported: result.databasesImported,
      });
    } finally {
      yield* Effect.promise(() => rm(tmpBase, { recursive: true, force: true }));
    }
  });
}
