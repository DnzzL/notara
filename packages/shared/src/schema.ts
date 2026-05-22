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
  isFavorite: Schema.Boolean,
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
    "pdf",
    "database",
    "pageLink",
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
  titleLabel: Schema.String,
  titleHidden: Schema.Boolean,
}) {}

export class DatabaseField extends Schema.Class<DatabaseField>("DatabaseField")({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  type: Schema.Literal("text", "number", "select", "multiSelect", "date", "checkbox", "relation", "page"),
  options: Schema.NullOr(Schema.Array(Schema.String)),
  relationTargetDbId: Schema.NullOr(Schema.String),
}) {}

export class DatabaseRecord extends Schema.Class<DatabaseRecord>("DatabaseRecord")({
  id: Schema.String,
  databaseId: Schema.String,
  title: Schema.String,
  description: Schema.String,
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

export class Workspace extends Schema.Class<Workspace>("Workspace")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  role: Schema.Literal("owner", "member"),
  inviteToken: Schema.NullOr(Schema.String),
}) {}

export class WorkspaceMember extends Schema.Class<WorkspaceMember>("WorkspaceMember")({
  userId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.Literal("owner", "member"),
}) {}

export class ApiKey extends Schema.Class<ApiKey>("ApiKey")({
  id: Schema.String,
  name: Schema.String,
  keyPrefix: Schema.String,
  createdAt: Schema.String,
  lastUsedAt: Schema.NullOr(Schema.String),
}) {}

/** Returned only once at creation — includes the raw key. */
export class ApiKeyCreated extends Schema.Class<ApiKeyCreated>("ApiKeyCreated")({
  id: Schema.String,
  name: Schema.String,
  keyPrefix: Schema.String,
  rawKey: Schema.String,
  createdAt: Schema.String,
}) {}

export const AclRelation = Schema.Literal("owner", "editor", "viewer");

/** A single ACL entry on a resource. Subject is e.g. "user:<id>" or "workspace:<id>#member". */
export class AclEntry extends Schema.Class<AclEntry>("AclEntry")({
  relation: AclRelation,
  subject: Schema.String,
}) {}