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
  deletedAt: Schema.NullOr(Schema.String),
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
    "file",
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
  deletedAt: Schema.NullOr(Schema.String),
}) {}

export const DatabaseFieldType = Schema.Literal(
  "text", "number", "select", "multiSelect", "date", "checkbox", "relation", "page", "formula",
);

export class DatabaseField extends Schema.Class<DatabaseField>("DatabaseField")({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  type: DatabaseFieldType,
  options: Schema.NullOr(Schema.Array(Schema.String)),
  relationTargetDbId: Schema.NullOr(Schema.String),
  formula: Schema.NullOr(Schema.String),
  sortOrder: Schema.Number,
}) {}

export class DatabaseRecord extends Schema.Class<DatabaseRecord>("DatabaseRecord")({
  id: Schema.String,
  databaseId: Schema.String,
  title: Schema.String,
  description: Schema.String,
  pageId: Schema.NullOr(Schema.String),
  isDeleted: Schema.Boolean,
  createdAt: Schema.String,
  deletedAt: Schema.NullOr(Schema.String),
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
  isDeleted: Schema.optional(Schema.Boolean),
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

/** A single trashed item, identified for restore/purge. */
export class TrashedPage extends Schema.Class<TrashedPage>("TrashedPage")({
  id: Schema.String,
  title: Schema.String,
  deletedAt: Schema.NullOr(Schema.String),
}) {}

export class TrashedDatabase extends Schema.Class<TrashedDatabase>("TrashedDatabase")({
  id: Schema.String,
  name: Schema.String,
  deletedAt: Schema.NullOr(Schema.String),
}) {}

export class TrashedRecord extends Schema.Class<TrashedRecord>("TrashedRecord")({
  id: Schema.String,
  databaseId: Schema.String,
  title: Schema.String,
  deletedAt: Schema.NullOr(Schema.String),
}) {}

/** Everything in the current workspace's trash, grouped by type. */
export class TrashContents extends Schema.Class<TrashContents>("TrashContents")({
  pages: Schema.Array(TrashedPage),
  databases: Schema.Array(TrashedDatabase),
  records: Schema.Array(TrashedRecord),
}) {}

export const AclRelation = Schema.Literal("owner", "editor", "viewer");

/**
 * Zanzibar-style subject. A grant always targets one of:
 *   - a specific user
 *   - the userset "all members of workspace X"
 *   - the "public" pseudo-userset (anyone with the link)
 *
 * On the wire and at REST boundaries we use this structured form; in storage
 * it serialises to the canonical strings `user:<id>` / `workspace:<id>#member` / `public`
 * (see `encodeSubject`/`decodeSubject` in @notion-alt/shared).
 */
export const Subject = Schema.Union(
  Schema.Struct({ type: Schema.Literal("user"), id: Schema.String }),
  Schema.Struct({
    type: Schema.Literal("workspace"),
    id: Schema.String,
    relation: Schema.Literal("member"),
  }),
  Schema.Struct({ type: Schema.Literal("public") }),
);
export type Subject = Schema.Schema.Type<typeof Subject>;

/** Per-resource monotonic revision token (zookie). */
export const AclRevision = Schema.String;

/** A single ACL entry on a resource. */
export class AclEntry extends Schema.Class<AclEntry>("AclEntry")({
  relation: AclRelation,
  subject: Subject,
}) {}

/** Direct + inherited grants on a page. `inheritedFromPageId` is null when grants
 *  live on the requested page itself; otherwise it identifies the locked ancestor. */
export class PagePermissions extends Schema.Class<PagePermissions>("PagePermissions")({
  direct: Schema.Array(AclEntry),
  inheritedFromPageId: Schema.NullOr(Schema.String),
  inherited: Schema.Array(AclEntry),
  revision: AclRevision,
}) {}

/** Encode a structured Subject to its canonical wire/storage string. */
export function encodeSubject(s: Subject): string {
  switch (s.type) {
    case "user":
      return `user:${s.id}`;
    case "workspace":
      return `workspace:${s.id}#${s.relation}`;
    case "public":
      return "public";
  }
}

/** Decode a canonical subject string. Returns null on malformed input. */
export function decodeSubject(raw: string): Subject | null {
  if (raw === "public") return { type: "public" };
  if (raw.startsWith("user:")) {
    const id = raw.slice(5);
    return id ? { type: "user", id } : null;
  }
  if (raw.startsWith("workspace:")) {
    const rest = raw.slice(10);
    const hash = rest.indexOf("#");
    if (hash < 0) return null;
    const id = rest.slice(0, hash);
    const relation = rest.slice(hash + 1);
    if (!id || relation !== "member") return null;
    return { type: "workspace", id, relation: "member" };
  }
  return null;
}

export function subjectsEqual(a: Subject, b: Subject): boolean {
  return encodeSubject(a) === encodeSubject(b);
}