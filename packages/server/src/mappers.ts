import type { Page, Block, Database, DatabaseField, DatabaseRecord, RecordFieldValue, DatabaseView } from "@notion-alt/shared";

/**
 * Row mappers -- pure functions that coerce SQLite rows into typed domain objects.
 *
 * Each mapper handles: boolean coercion (0/1 -> true/false), date formatting,
 * JSON parsing for options, and null defaults. The SELECT column aliasing
 * (e.g. `parent_id as "parentId"`) lives here as a shared string constant.
 *
 * The deletion test confirms depth: removing these functions would force every
 * handler to reimplement the same coercion logic (complexity reappears across
 * 7+ callers).
 */

// ── Page Mapper ──────────────────────────────────────────────────────────────

export function pageFromRow(r: unknown): Page {
  const row = r as Record<string, unknown>;
  return {
    id: row.id as string,
    title: row.title as string,
    parentId: (row.parentId as string | null) ?? null,
    icon: (row.icon as string | null) ?? null,
    coverUrl: (row.coverUrl as string | null) ?? null,
    sortOrder: Number(row.sortOrder ?? 0),
    isDeleted: (row.isDeleted as number) === 1,
    createdAt: new Date(row.createdAt as string).toISOString(),
    updatedAt: new Date(row.updatedAt as string).toISOString(),
  };
}

// ── Block Mapper ─────────────────────────────────────────────────────────────

export function blockFromRow(r: unknown): Block {
  return r as Block;
}

// ── Database Mapper ──────────────────────────────────────────────────────────

export function dbFromRow(r: unknown): Database {
  const row = r as Record<string, unknown>;
  return {
    id: row.id as string,
    pageId: row.pageId as string,
    name: row.name as string,
    isDeleted: (row.isDeleted as number) === 1,
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

// ── DatabaseField Mapper ─────────────────────────────────────────────────────

export function fieldFromRow(r: unknown): DatabaseField {
  const row = r as Record<string, unknown>;
  return {
    id: row.id as string,
    databaseId: row.databaseId as string,
    name: row.name as string,
    type: row.type as DatabaseField["type"],
    options: row.options ? JSON.parse(row.options as string) : null,
    relationTargetDbId: (row.relationTargetDbId as string | null) ?? null,
  };
}

// ── DatabaseRecord Mapper ────────────────────────────────────────────────────

export function recordFromRow(r: unknown): DatabaseRecord {
  const row = r as Record<string, unknown>;
  return {
    id: row.id as string,
    databaseId: row.databaseId as string,
    title: row.title as string,
    isDeleted: (row.isDeleted as number) === 1,
    createdAt: new Date(row.createdAt as string).toISOString(),
  };
}

// ── RecordFieldValue Mapper ──────────────────────────────────────────────────

export function valueFromRow(r: unknown): RecordFieldValue {
  return r as RecordFieldValue;
}

// ── DatabaseView Mapper ──────────────────────────────────────────────────────

export function viewFromRow(r: unknown): DatabaseView {
  const row = r as Record<string, unknown>;
  return {
    id: row.id as string,
    databaseId: row.databaseId as string,
    name: row.name as string,
    type: row.type as DatabaseView["type"],
    groupByFieldId: (row.groupByFieldId as string | null) ?? null,
    sortFieldId: (row.sortFieldId as string | null) ?? null,
    sortOrder: (row.sortOrder as "asc" | "desc") ?? "asc",
  };
}
