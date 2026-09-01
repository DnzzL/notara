import {
	Block,
	Database,
	DatabaseField,
	DatabaseRecord,
	DatabaseView,
	Page,
	RecordFieldValue,
} from "@notara/shared";

/**
 * Row mappers and their companion SELECT column constants.
 *
 * Keeping column aliases co-located with their mapper means the contract is
 * self-contained: a handler that imports both PAGE_COLS and pageFromRow cannot
 * silently produce undefined fields due to a forgotten alias.
 *
 * The deletion test confirms depth: removing these functions would force every
 * handler to reimplement boolean coercion, date formatting, and JSON parsing
 * across 7+ callers.
 */

// ── Page ─────────────────────────────────────────────────────────────────────

export const PAGE_COLS = `id, title, parent_id as "parentId", icon,
  cover_url as "coverUrl", sort_order as "sortOrder",
  is_deleted as "isDeleted", is_favorite as "isFavorite",
  created_at as "createdAt", updated_at as "updatedAt",
  deleted_at as "deletedAt"`;

export function pageFromRow(r: unknown): Page {
	const row = r as Record<string, unknown>;
	return new Page({
		id: row.id as string,
		title: row.title as string,
		parentId: (row.parentId as string | null) ?? null,
		icon: (row.icon as string | null) ?? null,
		coverUrl: (row.coverUrl as string | null) ?? null,
		sortOrder: Number(row.sortOrder ?? 0),
		isDeleted: (row.isDeleted as number) === 1,
		isFavorite: (row.isFavorite as number) === 1,
		createdAt: new Date(row.createdAt as string).toISOString(),
		updatedAt: new Date(row.updatedAt as string).toISOString(),
		deletedAt: (row.deletedAt as string | null) ?? null,
	});
}

// ── Block ─────────────────────────────────────────────────────────────────────

export const BLOCK_COLS = `id, page_id as "pageId", type, content,
  parent_id as "parentId", "index"`;

export function blockFromRow(r: unknown): Block {
	const row = r as Record<string, unknown>;
	return new Block({
		id: row.id as string,
		pageId: row.pageId as string,
		type: row.type as Block["type"],
		content: (row.content as string) ?? "",
		parentId: (row.parentId as string | null) ?? null,
		index: Number(row.index ?? 0),
	});
}

// ── Database ─────────────────────────────────────────────────────────────────

export const DB_COLS = `id, page_id as "pageId", name,
  is_deleted as "isDeleted", sort_order as "sortOrder",
  title_label as "titleLabel", title_hidden as "titleHidden",
  deleted_at as "deletedAt"`;

export function dbFromRow(r: unknown): Database {
	const row = r as Record<string, unknown>;
	return new Database({
		id: row.id as string,
		pageId: row.pageId as string,
		name: row.name as string,
		isDeleted: (row.isDeleted as number) === 1,
		sortOrder: Number(row.sortOrder ?? 0),
		titleLabel: (row.titleLabel as string | null) ?? "Name",
		titleHidden: (row.titleHidden as number) === 1,
		deletedAt: (row.deletedAt as string | null) ?? null,
	});
}

// ── DatabaseField ─────────────────────────────────────────────────────────────

export const FIELD_COLS = `id, database_id as "databaseId", name, type,
  options, relation_target_db_id as "relationTargetDbId",
  formula, sort_order as "sortOrder", sync_linked_row as "syncLinkedRow"`;

export function fieldFromRow(r: unknown): DatabaseField {
	const row = r as Record<string, unknown>;
	return new DatabaseField({
		id: row.id as string,
		databaseId: row.databaseId as string,
		name: row.name as string,
		type: row.type as DatabaseField["type"],
		options: row.options ? JSON.parse(row.options as string) : null,
		relationTargetDbId: (row.relationTargetDbId as string | null) ?? null,
		formula: (row.formula as string | null) ?? null,
		sortOrder: Number(row.sortOrder ?? 0),
		syncLinkedRow: (row.syncLinkedRow as number) === 1,
	});
}

// ── DatabaseRecord ────────────────────────────────────────────────────────────

export const RECORD_COLS = `id, database_id as "databaseId", title, description,
  page_id as "pageId", is_deleted as "isDeleted", created_at as "createdAt",
  deleted_at as "deletedAt"`;

export function recordFromRow(r: unknown): DatabaseRecord {
	const row = r as Record<string, unknown>;
	return new DatabaseRecord({
		id: row.id as string,
		databaseId: row.databaseId as string,
		title: row.title as string,
		description: (row.description as string | null) ?? "",
		pageId: (row.pageId as string | null) ?? null,
		isDeleted: (row.isDeleted as number) === 1,
		createdAt: new Date(row.createdAt as string).toISOString(),
		deletedAt: (row.deletedAt as string | null) ?? null,
	});
}

// ── RecordFieldValue ──────────────────────────────────────────────────────────

export function valueFromRow(r: unknown): RecordFieldValue {
	const row = r as Record<string, unknown>;
	return new RecordFieldValue({
		id: row.id as string,
		recordId: row.recordId as string,
		fieldId: row.fieldId as string,
		value: row.value as string,
	});
}

// ── DatabaseView ──────────────────────────────────────────────────────────────

export const VIEW_COLS = `id, database_id as "databaseId", name, type,
  group_by_field_id as "groupByFieldId",
  sort_field_id as "sortFieldId",
  sort_order as "sortOrder",
  config,
  is_default as "isDefault"`;

export function viewFromRow(r: unknown): DatabaseView {
	const row = r as Record<string, unknown>;
	return new DatabaseView({
		id: row.id as string,
		databaseId: row.databaseId as string,
		name: row.name as string,
		type: row.type as DatabaseView["type"],
		groupByFieldId: (row.groupByFieldId as string | null) ?? null,
		sortFieldId: (row.sortFieldId as string | null) ?? null,
		sortOrder: (row.sortOrder as "asc" | "desc") ?? "asc",
		config: (row.config as string) ?? "{}",
		isDefault: row.isDefault === true || row.isDefault === 1,
	});
}
