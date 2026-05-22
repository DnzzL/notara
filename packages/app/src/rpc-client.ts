/**
 * Typed RPC client for the Effect RPC HTTP server.
 *
 * Uses fetch for transport (works in browsers without Effect platform HttpClient).
 * Response types are inferred from the shared AppRpc schema definitions.
 * The Interface is a simple Promise-based API; the Implementation validates
 * responses through Effect's serialization protocol.
 */
import {
  Page,
  Block,
  Database,
  DatabaseField,
  DatabaseRecord,
  RecordFieldValue,
  DatabaseView,
  Backlink,
  SearchResult,
  Workspace,
  WorkspaceMember,
  ApiKey,
  ApiKeyCreated,
  AclEntry,
} from "@notion-alt/shared";

export type AclRelation = "owner" | "editor" | "viewer";

const API_URL = "/api";
let nextId = 1;

let currentWorkspaceId: string | null = null;

export function setCurrentWorkspaceId(id: string | null) {
  currentWorkspaceId = id;
}

export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId;
}

async function rpcCall<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const id = String(nextId++);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (currentWorkspaceId) {
    headers["X-Workspace-Id"] = currentWorkspaceId;
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      _tag: "Request",
      id,
      tag: method,
      payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed: ${response.status} ${response.statusText}`);
  }

  const results = await response.json();
  const result = (results as Array<{ requestId: string; _tag: string; exit: { _tag: string; value?: T; cause?: unknown } }>).find(
    (r) => r.requestId === id,
  );
  if (!result) throw new Error(`RPC ${method}: no response for id ${id}`);

  if (result._tag === "Exit" && result.exit._tag === "Failure") {
    throw new Error(`RPC ${method} error: ${JSON.stringify(result.exit.cause)}`);
  }

  return result.exit.value as T;
}

export const api = {
  // Pages
  listPages: () => rpcCall<Page[]>("listPages", {}),
  getPage: (id: string) => rpcCall<Page>("getPage", { id }),
  createPage: (title: string, parentId: string | null = null) =>
    rpcCall<Page>("createPage", { title, parentId }),
  updatePage: (id: string, patch: { title?: string | null; icon?: string | null; coverUrl?: string | null; isFavorite?: boolean | null }) =>
    rpcCall<Page>("updatePage", { id, ...patch }),
  deletePage: (id: string) => rpcCall<void>("deletePage", { id }),
  globalSearch: (query: string) => rpcCall<SearchResult[]>("globalSearch", { query }),
  movePage: (id: string, parentId: string | null) =>
    rpcCall<Page>("movePage", { id, parentId }),
  reorderPages: (parentId: string | null, pageIds: string[]) =>
    rpcCall<{ reordered: boolean }>("reorderPages", { parentId, pageIds }),

  // Blocks
  listBlocks: (pageId: string) => rpcCall<Block[]>("listBlocks", { pageId }),
  createBlock: (req: { pageId: string; type: string; content: string; index: number; parentId?: string | null }) =>
    rpcCall<Block>("createBlock", req),
  updateBlock: (id: string, content: string) => rpcCall<Block>("updateBlock", { id, content }),
  deleteBlock: (id: string) => rpcCall<void>("deleteBlock", { id }),
  reorderBlocks: (pageId: string, blockIds: string[]) =>
    rpcCall<Block[]>("reorderBlocks", { pageId, blockIds }),

  // Databases
  listDatabases: (pageId: string) => rpcCall<Database[]>("listDatabases", { pageId }),
  listAllDatabases: () => rpcCall<Database[]>("listAllDatabases", {}),
  getDatabase: (id: string) => rpcCall<Database>("getDatabase", { id }),
  createDatabase: (pageId: string, name: string) =>
    rpcCall<Database>("createDatabase", { pageId, name }),
  listFields: (databaseId: string) => rpcCall<DatabaseField[]>("listFields", { databaseId }),
  createField: (req: { databaseId: string; name: string; type: string; options?: string[] | null; relationTargetDbId?: string | null }) =>
    rpcCall<DatabaseField>("createField", req),
  listRecords: (databaseId: string) => rpcCall<DatabaseRecord[]>("listRecords", { databaseId }),
  listRecordsWithValues: (databaseId: string) =>
    rpcCall<Array<{ record: DatabaseRecord; values: Record<string, unknown> }>>("listRecordsWithValues", { databaseId }),
  getRecordWithValues: (recordId: string) =>
    rpcCall<{ record: DatabaseRecord; values: Record<string, unknown> }>("getRecordWithValues", { recordId }),
  createRecord: (databaseId: string, title: string) =>
    rpcCall<DatabaseRecord>("createRecord", { databaseId, title }),
  updateFieldValue: (recordId: string, fieldId: string, value: string) =>
    rpcCall<RecordFieldValue>("updateFieldValue", { recordId, fieldId, value }),
  deleteRecord: (id: string) => rpcCall<void>("deleteRecord", { id }),
  listViews: (databaseId: string) => rpcCall<DatabaseView[]>("listViews", { databaseId }),
  createView: (req: { databaseId: string; name: string; type: string; groupByFieldId?: string | null }) =>
    rpcCall<DatabaseView>("createView", req),
  updateField: (id: string, updates: { name?: string; type?: string; options?: string[] | null; relationTargetDbId?: string | null }) =>
    rpcCall<DatabaseField>("updateField", { id, ...updates }),
  updateRecord: (id: string, patch: { title?: string; description?: string }) =>
    rpcCall<{ updated: boolean }>("updateRecord", { id, ...patch }),
  reorderRecords: (databaseId: string, recordIds: string[]) =>
    rpcCall<{ reordered: boolean }>("reorderRecords", { databaseId, recordIds }),
  reorderDatabases: (pageId: string, databaseIds: string[]) =>
    rpcCall<{ reordered: boolean }>("reorderDatabases", { pageId, databaseIds }),
  renameDatabase: (id: string, name: string) =>
    rpcCall<Database>("renameDatabase", { id, name }),
  updateDatabase: (id: string, patch: { titleLabel?: string; titleHidden?: boolean }) =>
    rpcCall<Database>("updateDatabase", { id, ...patch }),
  deleteField: (id: string) => rpcCall<{ deleted: boolean }>("deleteField", { id }),

  // Backlinks
  getBacklinks: (pageId: string) => rpcCall<Backlink[]>("getBacklinks", { pageId }),

  // Import/Export
  importNotion: (directory: string) =>
    rpcCall<{ pagesImported: number; databasesImported: number }>("importNotion", { directory }),
  exportPage: (pageId: string, includeDatabases: boolean) =>
    rpcCall<{ pageId: string; title: string; markdown: string; databasesExported: number }>("exportPage", { pageId, includeDatabases }),
  exportDatabase: (dbId: string) =>
    rpcCall<{ dbId: string; name: string; csv: string }>("exportDatabase", { dbId }),
  exportAll: (outputDir: string) =>
    rpcCall<{ pagesExported: number; databasesExported: number; outputDir: string }>("exportAll", { outputDir }),

  // Workspaces
  getMyWorkspaces: () => rpcCall<Workspace[]>("getMyWorkspaces", {}),
  createWorkspace: (name: string, slug: string) =>
    rpcCall<Workspace>("createWorkspace", { name, slug }),
  joinWorkspaceByToken: (inviteToken: string) =>
    rpcCall<Workspace>("joinWorkspaceByToken", { inviteToken }),
  getWorkspaceMembers: (workspaceId: string) =>
    rpcCall<WorkspaceMember[]>("getWorkspaceMembers", { workspaceId }),
  removeMember: (workspaceId: string, userId: string) =>
    rpcCall<void>("removeMember", { workspaceId, userId }),
  regenerateInviteLink: (workspaceId: string) =>
    rpcCall<{ inviteToken: string }>("regenerateInviteLink", { workspaceId }),
  inviteMemberByEmail: (workspaceId: string, email: string) =>
    rpcCall<void>("inviteMemberByEmail", { workspaceId, email }),

  // Page permissions (ReBAC)
  getPagePermissions: (pageId: string) =>
    rpcCall<AclEntry[]>("getPagePermissions", { pageId }),
  setPagePermission: (pageId: string, subject: string, relation: AclRelation) =>
    rpcCall<void>("setPagePermission", { pageId, subject, relation }),
  removePagePermission: (pageId: string, subject: string, relation: AclRelation) =>
    rpcCall<void>("removePagePermission", { pageId, subject, relation }),

  listApiKeys: () =>
    rpcCall<ApiKey[]>("listApiKeys", {}),
  createApiKey: (name: string) =>
    rpcCall<ApiKeyCreated>("createApiKey", { name }),
  revokeApiKey: (id: string) =>
    rpcCall<void>("revokeApiKey", { id }),
};
