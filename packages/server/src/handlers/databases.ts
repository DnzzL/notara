import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { ulid } from "ulidx";
import { dbFromRow, fieldFromRow, recordFromRow, viewFromRow } from "../mappers.js";

export const listDatabases = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
      FROM databases WHERE page_id = ${pageId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;
    return rows.map(dbFromRow);
  });

export const getDatabase = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
      FROM databases WHERE id = ${id} AND is_deleted = 0
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Database ${id} not found`));
    return dbFromRow(rows[0]);
  });

export const createDatabase = (req: { pageId: string; name: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = ulid();
    const rows = yield* sql`
      INSERT INTO databases (id, page_id, name)
      VALUES (${id}, ${req.pageId}, ${req.name})
      RETURNING id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
    `;
    return dbFromRow(rows[0]);
  });

export const listFields = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, database_id as "databaseId", name, type,
             options, relation_target_db_id as "relationTargetDbId"
      FROM database_fields WHERE database_id = ${databaseId}
    `;
    return rows.map(fieldFromRow);
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
  return fieldFromRow(rows[0]);
});

export const listRecords = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, database_id as "databaseId", title,
             is_deleted as "isDeleted", created_at as "createdAt"
      FROM database_records WHERE database_id = ${databaseId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;
    return rows.map(recordFromRow);
  });

export const listRecordsWithValues = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Fetch records
    const records = yield* sql`
      SELECT id, database_id as "databaseId", title,
             is_deleted as "isDeleted", created_at as "createdAt"
      FROM database_records WHERE database_id = ${databaseId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;

    if (records.length === 0) return [];

    // Fetch all field values in one query
    const recordIds = records.map((r) => r.id);
    const fieldValues = yield* sql`
      SELECT rf.record_id as "recordId", rf.field_id as "fieldId", rf.value, df.name, df.type
      FROM record_field_values rf
      JOIN database_fields df ON rf.field_id = df.id
      WHERE rf.record_id IN ${sql.in(recordIds)}
    `;

    // Build value maps per record
    const valueMaps = new Map<string, Record<string, unknown>>();
    for (const fv of fieldValues as unknown as Array<{ recordId: string; name: string; type: string; value: string }>) {
      if (!valueMaps.has(fv.recordId)) valueMaps.set(fv.recordId, {});
      const vm = valueMaps.get(fv.recordId)!;
      vm[fv.name] = fv.type === "number" ? Number(fv.value) :
                    fv.type === "checkbox" ? fv.value === "true" :
                    fv.type === "select" ? fv.value :
                    fv.type === "multiSelect" ?
                      (fv.value ? JSON.parse(fv.value) : []) :
                    fv.value;
    }

    return records.map(recordFromRow).map((record) => ({
      record,
      values: valueMaps.get(record.id) ?? {},
    }));
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
                        fv.type === "select" ? fv.value :
                        fv.type === "multiSelect" ?
                          (fv.value ? JSON.parse(fv.value) : []) :
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
      return rows[0];
    } else {
      const id = ulid();
      const rows = yield* sql`
        INSERT INTO record_field_values (id, record_id, field_id, value)
        VALUES (${id}, ${req.recordId}, ${req.fieldId}, ${req.value})
        RETURNING id, record_id as "recordId", field_id as "fieldId", value
      `;
      return rows[0];
    }
  });

export const deleteRecord = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE database_records SET is_deleted = 1 WHERE id = ${id}`;
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

export const updateField = (req: { id: string; name?: string; options?: string[] | null; relationTargetDbId?: string | null }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const existing = yield* sql`
      SELECT name, options, relation_target_db_id as "relationTargetDbId"
      FROM database_fields WHERE id = ${req.id}
    `;
    if (existing.length === 0) return yield* Effect.fail(new Error(`Field ${req.id} not found`));

    const current = existing[0];
    const newName = req.name ?? current.name;
    const newOptions = req.options === undefined ? current.options : (req.options ? JSON.stringify(req.options) : null);
    const newRelationTargetDbId = req.relationTargetDbId === undefined ? current.relationTargetDbId : req.relationTargetDbId;

    const rows = yield* sql`
      UPDATE database_fields
      SET name = ${newName}, options = ${newOptions}, relation_target_db_id = ${newRelationTargetDbId}
      WHERE id = ${req.id}
      RETURNING id, database_id as "databaseId", name, type, options, relation_target_db_id as "relationTargetDbId"
    `;
    return fieldFromRow(rows[0]);
  });

export const deleteField = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM database_fields WHERE id = ${id}`;
    return { deleted: true };
  });

export const renameDatabase = (req: { id: string; name: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      UPDATE databases SET name = ${req.name}
      WHERE id = ${req.id} AND is_deleted = 0
      RETURNING id, page_id as "pageId", name, is_deleted as "isDeleted", sort_order as "sortOrder"
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Database ${req.id} not found`));
    return dbFromRow(rows[0]);
  });

export const reorderRecords = (req: { databaseId: string; recordIds: string[] }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* Effect.all(
      req.recordIds.map((recordId, index) =>
        sql`UPDATE database_records SET sort_order = ${index + 1} WHERE id = ${recordId}`
      ),
    );
    return { reordered: true };
  });

export const reorderDatabases = (req: { pageId: string; databaseIds: string[] }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* Effect.all(
      req.databaseIds.map((dbId, index) =>
        sql`UPDATE databases SET sort_order = ${index + 1} WHERE id = ${dbId} AND page_id = ${req.pageId}`
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
  return viewFromRow(rows[0]);
});
