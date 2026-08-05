import { SqlClient } from "@effect/sql";
import { NotFoundError } from "@notara/shared";
import { Effect } from "effect";
import { ulid } from "ulidx";
import {
	DB_COLS,
	dbFromRow,
	FIELD_COLS,
	fieldFromRow,
	RECORD_COLS,
	recordFromRow,
	VIEW_COLS,
	viewFromRow,
} from "../mappers.js";
import { publishViewConfigChange } from "../view-config-stream.js";

/** Decode a stored cell value into the shape the client expects for its type.
 *  Total by construction: a malformed value (e.g. a bare string in a
 *  multiSelect column) degrades to a best-effort value instead of throwing,
 *  so one bad cell can never crash a whole record-list load. */
const decodeFieldValue = (type: string, value: string): unknown => {
	if (type === "number") return Number(value);
	if (type === "checkbox") return value === "true";
	if (type === "select") return value;
	if (type === "multiSelect") {
		if (!value) return [];
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [String(parsed)]; // tolerate legacy bare value
		} catch {
			return value ? [value] : []; // never throw — degrade a bad cell to a 1-element array
		}
	}
	return value;
};

/** Convert a stored cell value from one column type's storage format to
 *  another when a column's type changes. Lossless conversions only; anything
 *  else is left as-is (the read path tolerates it). Never throws. */
const migrateFieldValue = (
	oldType: string,
	newType: string,
	value: string,
): string => {
	if (oldType === newType || !value) return value;
	// select stores a bare string; multiSelect stores a JSON array.
	if (oldType === "select" && newType === "multiSelect") {
		return JSON.stringify([value]);
	}
	if (oldType === "multiSelect" && newType === "select") {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.length ? String(parsed[0]) : "";
			return String(parsed);
		} catch {
			return value; // already a bare string
		}
	}
	return value;
};

/** Ensure a value destined for a multiSelect cell is a JSON-encoded array, so
 *  a bare string can never be persisted into a multiSelect column. */
const normalizeMultiSelectValue = (value: string): string => {
	if (!value) return value;
	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) return value;
		return JSON.stringify([String(parsed)]);
	} catch {
		return JSON.stringify([value]);
	}
};

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
	// Exclude databases whose parent page is itself trashed — otherwise deleting
	// a page would leave its databases visible here (orphans).
	const rows = yield* sql`
    SELECT ${sql.unsafe(DB_COLS)} FROM databases
    WHERE is_deleted = 0
      AND page_id NOT IN (SELECT id FROM pages WHERE is_deleted = 1)
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
		if (rows.length === 0)
			return yield* new NotFoundError({ resource: "database", id });
		return dbFromRow(rows[0]);
	});

export const createDatabase = (req: { pageId: string; name: string }) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const id = ulid();
		const rows = yield* sql`
      INSERT INTO databases (id, page_id, name)
      VALUES (${id}, ${req.pageId}, ${req.name})
      RETURNING ${sql.unsafe(DB_COLS)}
    `;

		// Create a default text column so a fresh database isn't empty.
		const fieldId = ulid();
		yield* sql`
      INSERT INTO database_fields (id, database_id, name, type, sort_order)
      VALUES (${fieldId}, ${id}, 'Notes', 'text', 1)
    `;

		// Create a default grid/table view marked as default.
		const viewId = ulid();
		yield* sql`
      INSERT INTO database_views (id, database_id, name, type, config, is_default)
      VALUES (${viewId}, ${id}, 'Grid', 'table', '{}', 1)
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
	databaseId: string;
	name: string;
	type: string;
	options: string[] | null;
	relationTargetDbId: string | null;
	formula?: string | null;
}) =>
	Effect.gen(function* () {
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
		for (const fv of fieldValues as unknown as Array<{
			recordId: string;
			name: string;
			type: string;
			value: string;
		}>) {
			if (!valueMaps.has(fv.recordId)) valueMaps.set(fv.recordId, {});
			const vm = valueMaps.get(fv.recordId)!;
			vm[fv.name] = decodeFieldValue(fv.type, fv.value);
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
      SELECT ${sql.unsafe(RECORD_COLS)} FROM database_records WHERE id = ${recordId} AND is_deleted = 0
    `;
		if (recordRows.length === 0)
			return yield* new NotFoundError({ resource: "record", id: recordId });
		const record = recordFromRow(recordRows[0]);

		const fieldValues = yield* sql`
      SELECT rf.field_id as "fieldId", rf.value, df.name, df.type
      FROM record_field_values rf
      JOIN database_fields df ON rf.field_id = df.id
      WHERE rf.record_id = ${recordId}
    `;

		const values: Record<string, unknown> = {};
		for (const fv of fieldValues as unknown as Array<{
			name: string;
			type: string;
			value: string;
		}>) {
			values[fv.name] = decodeFieldValue(fv.type, fv.value);
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

export const updateFieldValue = (req: {
	recordId: string;
	fieldId: string;
	value: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		// Normalize the value against the field's type so a malformed value (e.g. a
		// bare string in a multiSelect column) can never be persisted.
		const fieldRows =
			yield* sql`SELECT type FROM database_fields WHERE id = ${req.fieldId}`;
		const fieldType = (fieldRows[0] as { type: string } | undefined)?.type;
		const value =
			fieldType === "multiSelect"
				? normalizeMultiSelectValue(req.value)
				: req.value;
		const existing = yield* sql`
      SELECT id FROM record_field_values
      WHERE record_id = ${req.recordId} AND field_id = ${req.fieldId}
    `;
		if (existing.length > 0) {
			const rows = yield* sql`
        UPDATE record_field_values SET value = ${value}
        WHERE record_id = ${req.recordId} AND field_id = ${req.fieldId}
        RETURNING id, record_id as "recordId", field_id as "fieldId", value
      `;
			return rows[0];
		} else {
			const id = ulid();
			const rows = yield* sql`
        INSERT INTO record_field_values (id, record_id, field_id, value)
        VALUES (${id}, ${req.recordId}, ${req.fieldId}, ${value})
        RETURNING id, record_id as "recordId", field_id as "fieldId", value
      `;
			return rows[0];
		}
	});

export const deleteRecord = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const now = new Date().toISOString();
		const recRows =
			yield* sql`SELECT page_id as "pageId" FROM database_records WHERE id = ${id}`;
		yield* sql`UPDATE database_records SET is_deleted = 1, deleted_at = ${now} WHERE id = ${id}`;
		// A row and its lazily-created backing page are one entity: trash them together
		// so the page stops appearing as a ghost in the sidebar tree.
		const pageId = (recRows[0] as { pageId: string | null } | undefined)
			?.pageId;
		if (pageId) {
			yield* sql`UPDATE pages SET is_deleted = 1, deleted_at = ${now}, updated_at = ${now} WHERE id = ${pageId}`;
		}
	});

export const listViews = (databaseId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql`
      SELECT ${sql.unsafe(VIEW_COLS)} FROM database_views WHERE database_id = ${databaseId}
    `;
		return rows.map(viewFromRow);
	});

export const updateField = (req: {
	id: string;
	name?: string;
	type?: string;
	options?: string[] | null;
	relationTargetDbId?: string | null;
	formula?: string | null;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const existing = yield* sql`
      SELECT name, type, options, relation_target_db_id as "relationTargetDbId", formula
      FROM database_fields WHERE id = ${req.id}
    `;
		if (existing.length === 0)
			return yield* new NotFoundError({ resource: "field", id: req.id });

		const current = existing[0];
		const newName = req.name ?? current.name;
		const newType = req.type ?? current.type;
		const newOptions =
			req.options === undefined
				? current.options
				: req.options
					? JSON.stringify(req.options)
					: null;
		const newRelationTargetDbId =
			req.relationTargetDbId === undefined
				? current.relationTargetDbId
				: req.relationTargetDbId;
		const newFormula =
			req.formula === undefined ? current.formula : req.formula;

		// When the type changes, migrate existing cell values into the new type's
		// storage format (e.g. select "Thomas" -> multiSelect ["Thomas"]) so the
		// column can never be left holding values it cannot parse.
		if (req.type && req.type !== current.type) {
			const vals =
				yield* sql`SELECT id, value FROM record_field_values WHERE field_id = ${req.id}`;
			for (const row of vals as unknown as Array<{
				id: string;
				value: string;
			}>) {
				const migrated = migrateFieldValue(
					current.type as string,
					req.type,
					row.value,
				);
				if (migrated !== row.value) {
					yield* sql`UPDATE record_field_values SET value = ${migrated} WHERE id = ${row.id}`;
				}
			}
		}

		const rows = yield* sql`
      UPDATE database_fields
      SET name = ${newName}, type = ${newType}, options = ${newOptions},
          relation_target_db_id = ${newRelationTargetDbId}, formula = ${newFormula}
      WHERE id = ${req.id}
      RETURNING ${sql.unsafe(FIELD_COLS)}
    `;
		return fieldFromRow(rows[0]);
	});

export const reorderFields = (req: {
	databaseId: string;
	fieldIds: string[];
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.all(
			req.fieldIds.map(
				(fieldId, index) =>
					sql`UPDATE database_fields SET sort_order = ${index + 1} WHERE id = ${fieldId} AND database_id = ${req.databaseId}`,
			),
		);
		return { reordered: true };
	});

export const updateRecord = (req: {
	id: string;
	title?: string;
	description?: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const sets: string[] = [];
		const params: unknown[] = [];
		if (req.title !== undefined) {
			sets.push("title = ?");
			params.push(req.title);
		}
		if (req.description !== undefined) {
			sets.push("description = ?");
			params.push(req.description);
		}
		if (sets.length === 0) return { updated: false };
		params.push(req.id);
		yield* sql.unsafe(
			`UPDATE database_records SET ${sets.join(", ")} WHERE id = ?`,
			params,
		);
		return { updated: true };
	});

export const deleteField = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`DELETE FROM database_fields WHERE id = ${id}`;
		return { deleted: true };
	});

/** Soft-delete a database. Mirrors `deletePage`: the row is flagged
 *  `is_deleted = 1` so it drops out of listings; its fields and records are
 *  left in place (reversible). Returns `{ deleted: false }` if the id was
 *  unknown or already deleted. */
export const deleteDatabase = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const now = new Date().toISOString();
		const rows = yield* sql`
      UPDATE databases SET is_deleted = 1, deleted_at = ${now}
      WHERE id = ${id} AND is_deleted = 0
      RETURNING id
    `;
		return { deleted: rows.length > 0 };
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
		if (rows.length === 0)
			return yield* new NotFoundError({ resource: "database", id: req.id });
		return dbFromRow(rows[0]);
	});

export const updateDatabase = (req: {
	id: string;
	titleLabel?: string;
	titleHidden?: boolean;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const sets: string[] = [];
		const params: unknown[] = [];
		if (req.titleLabel !== undefined) {
			sets.push("title_label = ?");
			params.push(req.titleLabel);
		}
		if (req.titleHidden !== undefined) {
			sets.push("title_hidden = ?");
			params.push(req.titleHidden ? 1 : 0);
		}
		if (sets.length > 0) {
			params.push(req.id);
			yield* sql.unsafe(
				`UPDATE databases SET ${sets.join(", ")} WHERE id = ?`,
				params,
			);
		}
		const rows = yield* sql`
      SELECT ${sql.unsafe(DB_COLS)} FROM databases WHERE id = ${req.id}
    `;
		if (rows.length === 0)
			return yield* new NotFoundError({ resource: "database", id: req.id });
		return dbFromRow(rows[0]);
	});

export const reorderRecords = (req: {
	databaseId: string;
	recordIds: string[];
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.all(
			req.recordIds.map(
				(recordId, index) =>
					sql`UPDATE database_records SET sort_order = ${index + 1} WHERE id = ${recordId}`,
			),
		);
		return { reordered: true };
	});

export const reorderDatabases = (req: {
	pageId: string;
	databaseIds: string[];
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.all(
			req.databaseIds.map(
				(dbId, index) =>
					sql`UPDATE databases SET sort_order = ${index + 1} WHERE id = ${dbId} AND page_id = ${req.pageId}`,
			),
		);
		return { reordered: true };
	});

export const createView = (req: {
	databaseId: string;
	name: string;
	type: string;
	groupByFieldId: string | null;
	config?: string;
	isDefault?: boolean;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const id = ulid();

		// If this view is being created as default, clear any existing default first
		if (req.isDefault) {
			yield* sql`UPDATE database_views SET is_default = 0 WHERE database_id = ${req.databaseId} AND is_default = 1`;
		}

		const rows = yield* sql`
    INSERT INTO database_views (id, database_id, name, type, group_by_field_id, sort_order, config, is_default)
    VALUES (${id}, ${req.databaseId}, ${req.name}, ${req.type}, ${req.groupByFieldId}, 'asc', ${req.config ?? "{}"}, ${req.isDefault ? 1 : 0})
    RETURNING ${sql.unsafe(VIEW_COLS)}
  `;
		return viewFromRow(rows[0]);
	});

export const updateView = (req: {
	id: string;
	name?: string;
	type?: string;
	groupByFieldId?: string | null;
	config?: string;
	isDefault?: boolean;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const existing = yield* sql`
    SELECT database_id as "databaseId", name, type, group_by_field_id as "groupByFieldId", config, is_default as "isDefault"
    FROM database_views WHERE id = ${req.id}
  `;
		if (existing.length === 0)
			return yield* new NotFoundError({ resource: "view", id: req.id });
		const cur = existing[0] as any;
		const newName = req.name ?? cur.name;
		const newType = req.type ?? cur.type;
		const newGroupBy =
			req.groupByFieldId === undefined
				? cur.groupByFieldId
				: req.groupByFieldId;
		const newConfig = req.config ?? cur.config;

		// If setting this view as default, clear any existing default for this database
		let newIsDefault: boolean;
		if (req.isDefault !== undefined) {
			newIsDefault = req.isDefault;
			if (newIsDefault) {
				yield* sql`UPDATE database_views SET is_default = 0 WHERE database_id = ${cur.databaseId} AND id != ${req.id} AND is_default = 1`;
			}
		} else {
			newIsDefault = cur.isDefault === true || cur.isDefault === 1;
		}

		const rows = yield* sql`
    UPDATE database_views
    SET name = ${newName}, type = ${newType},
        group_by_field_id = ${newGroupBy}, config = ${newConfig},
        is_default = ${newIsDefault ? 1 : 0}
    WHERE id = ${req.id}
    RETURNING ${sql.unsafe(VIEW_COLS)}
  `;
		if (rows.length === 0)
			return yield* new NotFoundError({ resource: "view", id: req.id });
		const result = viewFromRow(rows[0]);
		// Notify SSE subscribers that this view's config changed
		publishViewConfigChange({
			type: "view.configChanged",
			viewId: result.id,
			databaseId: result.databaseId,
			config: result.config ?? newConfig,
			groupByFieldId: result.groupByFieldId,
			viewType: result.type,
		});
		return result;
	});

export const deleteView = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`DELETE FROM database_views WHERE id = ${id}`;
		return { deleted: true };
	});

// ── Trash: restore / permanent purge / sweep ────────────────────────────────────

export const restoreDatabase = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql`
      UPDATE databases SET is_deleted = 0, deleted_at = NULL
      WHERE id = ${id} AND is_deleted = 1
      RETURNING id
    `;
		return { restored: rows.length > 0 };
	});

export const restoreRecord = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const now = new Date().toISOString();
		const rows = yield* sql`
      UPDATE database_records SET is_deleted = 0, deleted_at = NULL
      WHERE id = ${id} AND is_deleted = 1
      RETURNING id, page_id as "pageId"
    `;
		// Restore the backing page alongside the row (mirror of deleteRecord).
		const pageId = (rows[0] as { pageId: string | null } | undefined)?.pageId;
		if (pageId) {
			yield* sql`UPDATE pages SET is_deleted = 0, deleted_at = NULL, updated_at = ${now} WHERE id = ${pageId}`;
		}
		return { restored: rows.length > 0 };
	});

// NOTE on cascade: SQLite foreign keys are NOT enforced on these connections
// (no `PRAGMA foreign_keys = ON`), and several FKs use NO ACTION, so we cannot
// rely on `ON DELETE CASCADE`. Purge handlers therefore delete children
// explicitly, inside a transaction. Order is irrelevant with FKs off, but we go
// leaf-to-root for clarity.

/** Permanently delete a record and its field values. */
export const purgeRecord = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const recRows =
			yield* sql`SELECT page_id as "pageId" FROM database_records WHERE id = ${id}`;
		yield* sql`DELETE FROM record_field_values WHERE record_id = ${id}`;
		yield* sql`DELETE FROM database_records WHERE id = ${id}`;
		const pageId = (recRows[0] as { pageId: string | null } | undefined)
			?.pageId;
		if (pageId) yield* purgePage(pageId);
		return { purged: true };
	});

/** Permanently delete a database and everything under it (records, field
 *  values, fields, views). */
export const purgeDatabase = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const backingRows =
			yield* sql`SELECT page_id as "pageId" FROM database_records WHERE database_id = ${id} AND page_id IS NOT NULL`;
		yield* sql`DELETE FROM record_field_values WHERE record_id IN (SELECT id FROM database_records WHERE database_id = ${id})`;
		yield* sql`DELETE FROM database_records WHERE database_id = ${id}`;
		yield* sql`DELETE FROM database_fields WHERE database_id = ${id}`;
		yield* sql`DELETE FROM database_views WHERE database_id = ${id}`;
		yield* sql`DELETE FROM databases WHERE id = ${id}`;
		const pageIds = backingRows.map((r) => (r as { pageId: string }).pageId);
		yield* Effect.forEach(pageIds, (pid) => purgePage(pid), { discard: true });
		return { purged: true };
	});

/** Permanently delete a page and everything under it: its blocks, and all of
 *  its databases (with their records, field values, fields, and views). */
export const purgePage = (
	id: string,
): Effect.Effect<{ purged: true }, any, SqlClient.SqlClient> =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		// Collect backing pages of this page's records before deleting those records.
		const backingRows = yield* sql`
      SELECT r.page_id as "pageId" FROM database_records r
      JOIN databases d ON d.id = r.database_id
      WHERE d.page_id = ${id} AND r.page_id IS NOT NULL`;
		yield* sql`DELETE FROM record_field_values WHERE record_id IN (
      SELECT r.id FROM database_records r JOIN databases d ON d.id = r.database_id WHERE d.page_id = ${id})`;
		yield* sql`DELETE FROM database_records WHERE database_id IN (SELECT id FROM databases WHERE page_id = ${id})`;
		yield* sql`DELETE FROM database_fields WHERE database_id IN (SELECT id FROM databases WHERE page_id = ${id})`;
		yield* sql`DELETE FROM database_views WHERE database_id IN (SELECT id FROM databases WHERE page_id = ${id})`;
		yield* sql`DELETE FROM databases WHERE page_id = ${id}`;
		yield* sql`DELETE FROM blocks WHERE page_id = ${id}`;
		yield* sql`DELETE FROM pages WHERE id = ${id}`;
		// Recurse into backing pages (which may themselves host databases).
		const pageIds = backingRows.map((r) => (r as { pageId: string }).pageId);
		yield* Effect.forEach(pageIds, (pid) => purgePage(pid), { discard: true });
		return { purged: true };
	});

/** Trash contents for the current workspace: explicitly-deleted pages,
 *  databases, and records (children hidden via a deleted parent are NOT listed,
 *  since their own `deleted_at` is null). Newest first. */
export const listTrash = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const pages = yield* sql`
    SELECT id, title, deleted_at as "deletedAt" FROM pages
    WHERE is_deleted = 1 ORDER BY deleted_at DESC
  `;
	const databases = yield* sql`
    SELECT id, name, deleted_at as "deletedAt" FROM databases
    WHERE is_deleted = 1 ORDER BY deleted_at DESC
  `;
	const records = yield* sql`
    SELECT id, database_id as "databaseId", title, deleted_at as "deletedAt" FROM database_records
    WHERE is_deleted = 1 ORDER BY deleted_at DESC
  `;
	return {
		pages: pages.map((r: any) => ({
			id: r.id as string,
			title: r.title as string,
			deletedAt: (r.deletedAt as string | null) ?? null,
		})),
		databases: databases.map((r: any) => ({
			id: r.id as string,
			name: r.name as string,
			deletedAt: (r.deletedAt as string | null) ?? null,
		})),
		records: records.map((r: any) => ({
			id: r.id as string,
			databaseId: r.databaseId as string,
			title: r.title as string,
			deletedAt: (r.deletedAt as string | null) ?? null,
		})),
	};
});

/** Lazily creates a full page for a database record.
 *  On first call: creates a page (child of the database's host page) with the
 *  record's title, stores its id on the record, and returns it.
 *  On subsequent calls: returns the already-associated pageId unchanged. */
export const openRecordAsPage = (recordId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const recRows = yield* sql`
      SELECT id, title, database_id as "databaseId", page_id as "pageId"
      FROM database_records WHERE id = ${recordId} AND is_deleted = 0
    `;
		if (recRows.length === 0)
			return yield* new NotFoundError({ resource: "record", id: recordId });
		const rec = recRows[0] as {
			id: string;
			title: string;
			databaseId: string;
			pageId: string | null;
		};

		if (rec.pageId) return { pageId: rec.pageId };

		const dbRows =
			yield* sql`SELECT page_id as "pageId" FROM databases WHERE id = ${rec.databaseId}`;
		if (dbRows.length === 0)
			return yield* new NotFoundError({
				resource: "database",
				id: rec.databaseId,
			});
		const hostPageId = (dbRows[0] as { pageId: string }).pageId;

		const pageId = ulid();
		const now = new Date().toISOString();
		yield* sql`
      INSERT INTO pages (id, title, parent_id, created_at, updated_at)
      VALUES (${pageId}, ${rec.title}, ${hostPageId}, ${now}, ${now})
    `;
		yield* sql`UPDATE database_records SET page_id = ${pageId} WHERE id = ${recordId}`;

		return { pageId };
	});

/** Permanently delete trashed rows whose `deleted_at` is older than the
 *  retention window, deep-purging children. Purging pages first means their
 *  databases/records go with them; the later passes mop up individually-trashed
 *  databases and records. Returns counts of explicitly-expired items.
 *  `datetime(...)` normalizes stored values (JS ISO `…T…Z` or the backfill's
 *  space-separated form) before comparing. */
export const purgeExpired = (retentionDays: number) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const cutoff = `-${Math.max(0, Math.floor(retentionDays))} days`;
		const expired = (table: string) =>
			sql.unsafe(
				`SELECT id FROM ${table} WHERE is_deleted = 1 AND deleted_at IS NOT NULL AND datetime(deleted_at) < datetime('now', ?)`,
				[cutoff],
			) as unknown as Effect.Effect<ReadonlyArray<{ id: string }>, any, never>;

		const pages = yield* expired("pages");
		const databases = yield* expired("databases");
		const records = yield* expired("database_records");

		yield* Effect.forEach(pages, (r) => purgePage(r.id), { discard: true });
		yield* Effect.forEach(databases, (r) => purgeDatabase(r.id), {
			discard: true,
		});
		yield* Effect.forEach(records, (r) => purgeRecord(r.id), { discard: true });

		return {
			pages: pages.length,
			databases: databases.length,
			records: records.length,
		};
	});
