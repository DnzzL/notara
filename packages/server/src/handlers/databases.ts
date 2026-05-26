import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { ulid } from "ulidx";
import { DB_COLS, dbFromRow, FIELD_COLS, fieldFromRow, RECORD_COLS, recordFromRow, VIEW_COLS, viewFromRow } from "../mappers.js";

export const listDatabases = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT ${sql.unsafe(DB_COLS)} FROM databases WHERE page_id = ${pageId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;
    return rows.map(dbFromRow);
  });

/** All non-deleted databases across every page. Used by the relation
 *  field's target picker so users can link to a database on any page. */
export const listAllDatabases = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    SELECT ${sql.unsafe(DB_COLS)} FROM databases WHERE is_deleted = 0
    ORDER BY sort_order ASC
  `;
  return rows.map(dbFromRow);
});

export const getDatabase = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT ${sql.unsafe(DB_COLS)} FROM databases WHERE id = ${id} AND is_deleted = 0
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Database ${id} not found`));
    return dbFromRow(rows[0]);
  });

export const createDatabase = (req: { pageId: string; name: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = ulid();
    // New databases hide the title column by default — users are expected
    // to define their own columns (page links, custom properties, …). The
    // title still exists under the hood and can be brought back from the
    // toolbar's "Show <Label> column" button.
    const rows = yield* sql`
      INSERT INTO databases (id, page_id, name, title_hidden)
      VALUES (${id}, ${req.pageId}, ${req.name}, 1)
      RETURNING ${sql.unsafe(DB_COLS)}
    `;
    return dbFromRow(rows[0]);
  });

export const listFields = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT ${sql.unsafe(FIELD_COLS)} FROM database_fields WHERE database_id = ${databaseId}
      ORDER BY sort_order ASC, id ASC
    `;
    return rows.map(fieldFromRow);
  });

export const createField = (req: {
  databaseId: string; name: string; type: string;
  options: string[] | null; relationTargetDbId: string | null;
  formula?: string | null;
}) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const id = ulid();
  const options = req.options ? JSON.stringify(req.options) : null;
  // Place new fields after existing ones (highest sort_order + 1).
  const maxRows = yield* sql`
    SELECT COALESCE(MAX(sort_order), 0) as "maxOrder"
    FROM database_fields WHERE database_id = ${req.databaseId}
  `;
  const nextOrder = Number((maxRows[0] as any)?.maxOrder ?? 0) + 1;
  const rows = yield* sql`
    INSERT INTO database_fields (id, database_id, name, type, options, relation_target_db_id, formula, sort_order)
    VALUES (${id}, ${req.databaseId}, ${req.name}, ${req.type}, ${options}, ${req.relationTargetDbId}, ${req.formula ?? null}, ${nextOrder})
    RETURNING ${sql.unsafe(FIELD_COLS)}
  `;
  return fieldFromRow(rows[0]);
});

export const listRecords = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT ${sql.unsafe(RECORD_COLS)} FROM database_records
      WHERE database_id = ${databaseId} AND is_deleted = 0
      ORDER BY sort_order ASC
    `;
    return rows.map(recordFromRow);
  });

export const listRecordsWithValues = (databaseId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Fetch records
    const records = yield* sql`
      SELECT ${sql.unsafe(RECORD_COLS)} FROM database_records
      WHERE database_id = ${databaseId} AND is_deleted = 0
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
      SELECT ${sql.unsafe(RECORD_COLS)} FROM database_records WHERE id = ${recordId}
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
      RETURNING ${sql.unsafe(RECORD_COLS)}
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
      SELECT ${sql.unsafe(VIEW_COLS)} FROM database_views WHERE database_id = ${databaseId}
    `;
    return rows.map(viewFromRow);
  });

export const updateField = (req: { id: string; name?: string; type?: string; options?: string[] | null; relationTargetDbId?: string | null; formula?: string | null }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const existing = yield* sql`
      SELECT name, type, options, relation_target_db_id as "relationTargetDbId", formula
      FROM database_fields WHERE id = ${req.id}
    `;
    if (existing.length === 0) return yield* Effect.fail(new Error(`Field ${req.id} not found`));

    const current = existing[0];
    const newName = req.name ?? current.name;
    const newType = req.type ?? current.type;
    const newOptions = req.options === undefined ? current.options : (req.options ? JSON.stringify(req.options) : null);
    const newRelationTargetDbId = req.relationTargetDbId === undefined ? current.relationTargetDbId : req.relationTargetDbId;
    const newFormula = req.formula === undefined ? current.formula : req.formula;

    const rows = yield* sql`
      UPDATE database_fields
      SET name = ${newName}, type = ${newType}, options = ${newOptions},
          relation_target_db_id = ${newRelationTargetDbId}, formula = ${newFormula}
      WHERE id = ${req.id}
      RETURNING ${sql.unsafe(FIELD_COLS)}
    `;
    return fieldFromRow(rows[0]);
  });

export const reorderFields = (req: { databaseId: string; fieldIds: string[] }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* Effect.all(
      req.fieldIds.map((fieldId, index) =>
        sql`UPDATE database_fields SET sort_order = ${index + 1} WHERE id = ${fieldId} AND database_id = ${req.databaseId}`
      ),
    );
    return { reordered: true };
  });

export const updateRecord = (req: { id: string; title?: string; description?: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (req.title !== undefined) { sets.push("title = ?"); params.push(req.title); }
    if (req.description !== undefined) { sets.push("description = ?"); params.push(req.description); }
    if (sets.length === 0) return { updated: false };
    params.push(req.id);
    yield* sql.unsafe(
      `UPDATE database_records SET ${sets.join(", ")} WHERE id = ?`,
      params
    );
    return { updated: true };
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
    yield* sql`
      UPDATE databases SET name = ${req.name}
      WHERE id = ${req.id} AND is_deleted = 0
    `;
    const rows = yield* sql`
      SELECT ${sql.unsafe(DB_COLS)} FROM databases WHERE id = ${req.id}
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Database ${req.id} not found`));
    return dbFromRow(rows[0]);
  });

export const updateDatabase = (req: { id: string; titleLabel?: string; titleHidden?: boolean }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (req.titleLabel !== undefined) { sets.push("title_label = ?"); params.push(req.titleLabel); }
    if (req.titleHidden !== undefined) { sets.push("title_hidden = ?"); params.push(req.titleHidden ? 1 : 0); }
    if (sets.length > 0) {
      params.push(req.id);
      yield* sql.unsafe(`UPDATE databases SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    const rows = yield* sql`
      SELECT ${sql.unsafe(DB_COLS)} FROM databases WHERE id = ${req.id}
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
    RETURNING ${sql.unsafe(VIEW_COLS)}
  `;
  return viewFromRow(rows[0]);
});
