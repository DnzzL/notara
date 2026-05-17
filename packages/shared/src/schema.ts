import { Schema } from "effect";

// Use String for datetime fields since SQLite returns ISO strings
export class Page extends Schema.Class<Page>("Page")({
  id: Schema.String,
  title: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  coverUrl: Schema.NullOr(Schema.String),
  sortOrder: Schema.Number,
  isDeleted: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class Block extends Schema.Class<Block>("Block")({
  id: Schema.String,
  pageId: Schema.String,
  type: Schema.Literal(
    "paragraph",
    "heading1",
    "heading2",
    "heading3",
    "bulletList",
    "numberedList",
    "todo",
    "code",
    "blockquote",
    "divider",
    "image",
    "database",
    "toggle",
    "callout",
  ),
  content: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  index: Schema.Number,
}) {}

export class Database extends Schema.Class<Database>("Database")({
  id: Schema.String,
  pageId: Schema.String,
  name: Schema.String,
  isDeleted: Schema.Boolean,
  sortOrder: Schema.Number,
}) {}

export class DatabaseField extends Schema.Class<DatabaseField>("DatabaseField")({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  type: Schema.Literal("text", "number", "select", "multiSelect", "date", "checkbox", "relation"),
  options: Schema.NullOr(Schema.Array(Schema.String)),
  relationTargetDbId: Schema.NullOr(Schema.String),
}) {}

export class DatabaseRecord extends Schema.Class<DatabaseRecord>("DatabaseRecord")({
  id: Schema.String,
  databaseId: Schema.String,
  title: Schema.String,
  isDeleted: Schema.Boolean,
  createdAt: Schema.String,
}) {}

export class RecordFieldValue extends Schema.Class<RecordFieldValue>("RecordFieldValue")({
  id: Schema.String,
  recordId: Schema.String,
  fieldId: Schema.String,
  value: Schema.String,
}) {}

export class DatabaseView extends Schema.Class<DatabaseView>("DatabaseView")({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  type: Schema.Literal("table", "board"),
  groupByFieldId: Schema.NullOr(Schema.String),
  sortFieldId: Schema.NullOr(Schema.String),
  sortOrder: Schema.Literal("asc", "desc"),
}) {}

/** A backlink represents a block that references another page. */
export class Backlink extends Schema.Class<Backlink>("Backlink")({
  blockId: Schema.String,
  pageId: Schema.String,
  pageTitle: Schema.String,
  content: Schema.String,
}) {}

/** A unified search result from pages or blocks. */
export class SearchResult extends Schema.Class<SearchResult>("SearchResult")({
  type: Schema.Literal("page", "block"),
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  pageId: Schema.String,
}) {}

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