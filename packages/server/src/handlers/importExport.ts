import { Effect } from "effect";
import { ImportResult, PageExport, DatabaseCsvExport } from "@notion-alt/shared";
import * as Import from "../import/notion.js";
import * as Export from "../export/page.js";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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
 * Import from a ZIP file buffer. Extracts to temp dir, runs import, cleans up.
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
      yield* Effect.promise(() => execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`));

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
