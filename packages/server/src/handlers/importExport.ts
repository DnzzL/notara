import { Effect } from "effect";
import { ImportResult, PageExport, DatabaseCsvExport } from "@notion-alt/shared";
import * as Import from "../import/notion.js";
import * as Export from "../export/page.js";

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
