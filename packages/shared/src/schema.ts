import { Schema } from "effect";

// Use String for datetime fields since SQLite returns ISO strings
export class Page extends Schema.Class<Page>("Page")({
  id: Schema.String,
  title: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  icon: Schema.NullOr(Schema.String),
  coverUrl: Schema.NullOr(Schema.String),
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
