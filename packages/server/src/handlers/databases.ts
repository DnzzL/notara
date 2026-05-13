import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { Database, DatabaseField, DatabaseRecord, RecordFieldValue, DatabaseView } from "@notion-alt/shared";
import { ulid } from "ulidx";

const databaseFromRow = (r: any): Database => ({
  ...r,
  isDeleted: r.isDeleted === 1,
});

export const listDatabases = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted"
      FROM databases WHERE page_id = ${pageId} AND is_deleted = 0
    `;
    return rows.map(databaseFromRow);
  });

export const getDatabase = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted"
      FROM databases WHERE id = ${id} AND is_deleted = 0
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Database ${id} not found`));
    return databaseFromRow(rows[0]);
  });

export const createDatabase = (req: { pageId: string; name: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = ulid();
    const rows = yield* sql`
      INSERT INTO databases (id, page_id, name)
      VALUES (${id}, ${req.pageId}, ${req.name})
      RETURNING id, page_id as "pageId", name, is_deleted as "isDeleted"
    `;
    return databaseFromRow(rows[0]);
  });

export const listFields = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, database_id as "databaseId", name, type,
             options, relation_target_db_id as "relationTargetDbId"
      FROM database_fields WHERE database_id = ${databaseId}
    `;
    return rows.map((r: any) => ({
      ...r,
      options: r.options ? JSON.parse(r.options) : null,
    })) as DatabaseField[];
  });

export const createField = (req: {
  databaseId: string; name: string; type: string;
  options: string[] | null; relationTargetDbId: string | null;
}) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const id = ulid();
  const options = req.options ? JSON.stringify(req.options) : null;
  const rows = yield* sql`
    INSERT INTO database_fields (id, database_id, name, type, options, relation_target_db_id)
    VALUES (${id}, ${req.databaseId}, ${req.name}, ${req.type}, ${options}, ${req.relationTargetDbId})
    RETURNING id, database_id as "databaseId", name, type, options, relation_target_db_id as "relationTargetDbId"
  `;
  const r = rows[0] as { options: string | null };
  return { ...r, options: r.options ? JSON.parse(r.options) : null } as DatabaseField;
});

const recordFromRow = (r: any): DatabaseRecord => ({
  ...r,
  isDeleted: r.isDeleted === 1,
  createdAt: new Date(r.createdAt).toISOString(),
});

export const listRecords = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, database_id as "databaseId", title,
             is_deleted as "isDeleted", created_at as "createdAt"
      FROM database_records WHERE database_id = ${databaseId} AND is_deleted = 0
      ORDER BY created_at ASC
    `;
    return rows.map(recordFromRow);
  });

export const getRecordWithValues = (recordId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const recordRows = yield* sql`
      SELECT id, database_id as "databaseId", title,
             is_deleted as "isDeleted", created_at as "createdAt"
      FROM database_records WHERE id = ${recordId}
    `;
    if (recordRows.length === 0) return yield* Effect.fail(new Error(`Record ${recordId} not found`));
    const record = recordFromRow(recordRows[0]);

    const fieldValues = yield* sql`
      SELECT rf.field_id as "fieldId", rf.value, df.name, df.type
      FROM record_field_values rf
      JOIN database_fields df ON rf.field_id = df.id
      WHERE rf.record_id = ${recordId}
    `;

    const values: Record<string, unknown> = {};
    for (const fv of fieldValues as unknown as Array<{ name: string; type: string; value: string }>) {
      values[fv.name] = fv.type === "number" ? Number(fv.value) :
                        fv.type === "checkbox" ? fv.value === "true" :
                        fv.type === "select" ? fv.value :  // single select: plain string
                        fv.type === "multiSelect" ?
                          (fv.value ? JSON.parse(fv.value) : []) :  // multiSelect: JSON array
                        fv.value;
    }

    return { record, values };
  });

export const createRecord = (req: { databaseId: string; title: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = ulid();
    const now = new Date().toISOString();
    const rows = yield* sql`
      INSERT INTO database_records (id, database_id, title, created_at)
      VALUES (${id}, ${req.databaseId}, ${req.title}, ${now})
      RETURNING id, database_id as "databaseId", title,
                is_deleted as "isDeleted", created_at as "createdAt"
    `;
    return recordFromRow(rows[0]);
  });

export const updateFieldValue = (req: { recordId: string; fieldId: string; value: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Check if exists, then update or insert
    const existing = yield* sql`
      SELECT id FROM record_field_values
      WHERE record_id = ${req.recordId} AND field_id = ${req.fieldId}
    `;
    if (existing.length > 0) {
      const rows = yield* sql`
        UPDATE record_field_values SET value = ${req.value}
        WHERE record_id = ${req.recordId} AND field_id = ${req.fieldId}
        RETURNING id, record_id as "recordId", field_id as "fieldId", value
      `;
      return rows[0] as RecordFieldValue;
    } else {
      const id = ulid();
      const rows = yield* sql`
        INSERT INTO record_field_values (id, record_id, field_id, value)
        VALUES (${id}, ${req.recordId}, ${req.fieldId}, ${req.value})
        RETURNING id, record_id as "recordId", field_id as "fieldId", value
      `;
      return rows[0] as RecordFieldValue;
    }
  });

export const deleteRecord = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE database_records SET is_deleted = 1 WHERE id = ${id}`;
  });

const viewFromRow = (r: any): DatabaseView => ({
  ...r,
  groupByFieldId: r.groupByFieldId || null,
  sortFieldId: r.sortFieldId || null,
});

export const listViews = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, database_id as "databaseId", name, type,
             group_by_field_id as "groupByFieldId",
             sort_field_id as "sortFieldId",
             sort_order as "sortOrder"
      FROM database_views WHERE database_id = ${databaseId}
    `;
    return rows.map(viewFromRow);
  });

export const updateField = (req: { id: string; options: string[] | null }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const options = req.options ? JSON.stringify(req.options) : null;
    const rows = yield* sql`
      UPDATE database_fields SET options = ${options}
      WHERE id = ${req.id}
      RETURNING id, database_id as "databaseId", name, type, options, relation_target_db_id as "relationTargetDbId"
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Field ${req.id} not found`));
    const r = rows[0] as { options: string | null };
    return { ...r, options: r.options ? JSON.parse(r.options) : null } as DatabaseField;
  });

export const reorderRecords = (req: { databaseId: string; recordIds: string[] }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Assign fractional sort orders to allow future insertions between records
    yield* Effect.all(
      req.recordIds.map((recordId, index) =>
        sql`UPDATE database_records SET sort_order = ${index + 1} WHERE id = ${recordId}`
      ),
    );
    return { reordered: true };
  });

export const createView = (req: {
  databaseId: string; name: string; type: string;
  groupByFieldId: string | null;
}) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const id = ulid();
  const rows = yield* sql`
    INSERT INTO database_views (id, database_id, name, type, group_by_field_id, sort_order)
    VALUES (${id}, ${req.databaseId}, ${req.name}, ${req.type}, ${req.groupByFieldId}, 'asc')
    RETURNING id, database_id as "databaseId", name, type,
              group_by_field_id as "groupByFieldId",
              sort_field_id as "sortFieldId",
              sort_order as "sortOrder"
  `;
  return viewFromRow(rows[0] as unknown as { [key: string]: unknown });
});
