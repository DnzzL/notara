/**
 * RPC handler wiring — maps AppRpc method tags to Effect closures that compose
 * auth, permission checks, handler calls, presence broadcasts, and analytics
 * tracking. Extracted from index.ts to keep infrastructure wiring separate from
 * RPC routing.
 */
import { Effect } from "effect";
import { AppRpc, RecordFieldValue } from "@notara/shared";
import { track } from "./observability.js";
import { presence } from "./presence/index.js";
import { getSessionUser, withWorkspaceDb, withAuthedWorkspace } from "./workspace-context.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import * as Search from "./handlers/search.js";
import * as ImportExport from "./handlers/importExport.js";
import * as Workspaces from "./handlers/workspaces.js";
import * as Onboarding from "./handlers/onboarding.js";
import * as Templates from "./handlers/templates.js";
import * as ApiKeys from "./handlers/api-keys.js";
import * as Permissions from "./handlers/permissions.js";

export const rpcHandlersLayer = AppRpc.toLayer({
  listPages: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const all = yield* Pages.listPages;
        return yield* Permissions.filterPagesByPermission(userId, workspaceId, role, all);
      }),
    ).pipe(Effect.orDie),
  getPage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "viewer");
        return yield* Pages.getPage(id);
      }),
    ).pipe(Effect.orDie),
  createPage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        const page = yield* Pages.createPage(req);
        track("page_created", userId, { workspace_id: workspaceId, page_id: page.id });
        return page;
      }),
    ).pipe(Effect.orDie),
  updatePage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.id, "editor");
        const page = yield* Pages.updatePage(req);
        presence.broadcast(workspaceId, req.id, {
          type: "page.metaUpdated",
          actorUserId: userId,
          fields: { title: page.title, icon: page.icon, coverUrl: page.coverUrl },
        });
        return page;
      }),
    ).pipe(Effect.orDie),
  deletePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Pages.deletePage(id);
      }),
    ).pipe(Effect.orDie),
  globalSearch: ({ query }) =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const results = yield* Search.globalSearch(query);
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return results.filter((r) => visibleIds.has(r.type === "page" ? r.id : r.pageId));
      }),
    ).pipe(Effect.orDie),
  movePage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.id, "editor");
        return yield* Pages.movePage(req);
      }),
    ).pipe(Effect.orDie),
  reorderPages: ({ parentId, pageIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        if (parentId !== null) {
          yield* Permissions.checkPagePermission(userId, workspaceId, parentId, "editor");
        }
        return yield* Pages.reorderPages({ parentId, pageIds: [...pageIds] });
      }),
    ).pipe(Effect.orDie),

  listBlocks: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Blocks.listBlocks(pageId);
      }),
    ).pipe(Effect.orDie),
  createBlock: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        const block = yield* Blocks.createBlock(req);
        presence.broadcast(workspaceId, req.pageId, {
          type: "block.created",
          actorUserId: userId,
          block,
        });
        return block;
      }),
    ).pipe(Effect.orDie),
  updateBlock: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkBlockPermission(userId, workspaceId, req.id, "editor");
        const pageId = yield* Blocks.getBlockPageId(req.id);
        if (pageId) {
          const holder = presence.lockHolder(workspaceId, pageId, req.id);
          if (holder && holder !== userId) {
            return yield* Effect.fail(new Error(`BlockLocked:${holder}`));
          }
        }
        const block = yield* Blocks.updateBlock(req);
        if (pageId) {
          presence.broadcast(workspaceId, pageId, {
            type: "block.updated",
            actorUserId: userId,
            blockId: req.id,
            content: req.content,
          });
        }
        return block;
      }),
    ).pipe(Effect.orDie),
  deleteBlock: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkBlockPermission(userId, workspaceId, id, "editor");
        const pageId = yield* Blocks.getBlockPageId(id);
        if (pageId) {
          const holder = presence.lockHolder(workspaceId, pageId, id);
          if (holder && holder !== userId) {
            return yield* Effect.fail(new Error(`BlockLocked:${holder}`));
          }
        }
        const result = yield* Blocks.deleteBlock(id);
        if (pageId) {
          presence.broadcast(workspaceId, pageId, {
            type: "block.deleted",
            actorUserId: userId,
            blockId: id,
          });
        }
        return result;
      }),
    ).pipe(Effect.orDie),
  reorderBlocks: ({ pageId, blockIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "editor");
        const result = yield* Blocks.reorderBlocks(pageId, [...blockIds]);
        presence.broadcast(workspaceId, pageId, {
          type: "block.reordered",
          actorUserId: userId,
          blockIds: [...blockIds],
        });
        return result;
      }),
    ).pipe(Effect.orDie),
  getBacklinks: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        const all = yield* Blocks.getBacklinks(pageId);
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return all.filter((b) => visibleIds.has(b.pageId));
      }),
    ).pipe(Effect.orDie),

  listDatabases: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Databases.listDatabases(pageId);
      }),
    ).pipe(Effect.orDie),
  listAllDatabases: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const all = yield* Databases.listAllDatabases;
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return all.filter((db) => visibleIds.has(db.pageId));
      }),
    ).pipe(Effect.orDie),
  getDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "viewer");
        return yield* Databases.getDatabase(id);
      }),
    ).pipe(Effect.orDie),
  createDatabase: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        return yield* Databases.createDatabase(req);
      }),
    ).pipe(Effect.orDie),
  listFields: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listFields(databaseId);
      }),
    ).pipe(Effect.orDie),
  createField: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.databaseId, "editor");
        return yield* Databases.createField({
          databaseId: req.databaseId,
          name: req.name,
          type: req.type,
          options: req.options ? [...req.options] : null,
          relationTargetDbId: req.relationTargetDbId,
          formula: req.formula ?? null,
        });
      }),
    ).pipe(Effect.orDie),
  listRecords: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listRecords(databaseId);
      }),
    ).pipe(Effect.orDie),
  listRecordsWithValues: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listRecordsWithValues(databaseId);
      }),
    ).pipe(Effect.orDie),
  getRecordWithValues: ({ recordId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, recordId, "viewer");
        return yield* Databases.getRecordWithValues(recordId);
      }),
    ).pipe(Effect.orDie),
  createRecord: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.databaseId, "editor");
        return yield* Databases.createRecord(req);
      }),
    ).pipe(Effect.orDie),
  updateFieldValue: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, req.recordId, "editor");
        const row = yield* Databases.updateFieldValue(req);
        return new RecordFieldValue({
          id: row.id as string,
          recordId: row.recordId as string,
          fieldId: row.fieldId as string,
          value: row.value as string,
        });
      }),
    ).pipe(Effect.orDie),
  deleteRecord: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteRecord(id);
      }),
    ).pipe(Effect.orDie),
  listViews: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listViews(databaseId);
      }),
    ).pipe(Effect.orDie),
  createView: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.databaseId, "editor");
        return yield* Databases.createView({
          databaseId: req.databaseId,
          name: req.name,
          type: req.type,
          groupByFieldId: req.groupByFieldId,
          config: req.config,
        });
      }),
    ).pipe(Effect.orDie),
  updateView: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateView({
          id: req.id,
          name: req.name,
          type: req.type,
          groupByFieldId: req.groupByFieldId,
          config: req.config,
        });
      }),
    ).pipe(Effect.orDie),
  deleteView: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteView(id);
      }),
    ).pipe(Effect.orDie),
  updateField: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkFieldPermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateField({
          id: req.id,
          name: req.name,
          type: req.type,
          options: req.options === undefined ? undefined : (req.options ? [...req.options] : null),
          relationTargetDbId: req.relationTargetDbId,
          formula: req.formula,
        });
      }),
    ).pipe(Effect.orDie),
  reorderFields: ({ databaseId, fieldIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "editor");
        return yield* Databases.reorderFields({ databaseId, fieldIds: [...fieldIds] });
      }),
    ).pipe(Effect.orDie),
  updateRecord: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateRecord(req);
      }),
    ).pipe(Effect.orDie),
  reorderRecords: ({ databaseId, recordIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "editor");
        return yield* Databases.reorderRecords({ databaseId, recordIds: [...recordIds] });
      }),
    ).pipe(Effect.orDie),
  openRecordAsPage: ({ recordId }) =>
    withAuthedWorkspace(() =>
      Databases.openRecordAsPage(recordId),
    ).pipe(Effect.orDie),
  renameDatabase: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.renameDatabase({ id: req.id, name: req.name });
      }),
    ).pipe(Effect.orDie),
  updateDatabase: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateDatabase(req);
      }),
    ).pipe(Effect.orDie),
  deleteField: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkFieldPermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteField(id);
      }),
    ).pipe(Effect.orDie),
  reorderDatabases: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        return yield* Databases.reorderDatabases({ pageId: req.pageId, databaseIds: [...req.databaseIds] });
      }),
    ).pipe(Effect.orDie),
  deleteDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteDatabase(id);
      }),
    ).pipe(Effect.orDie),

  // Trash: list / restore / permanent purge
  listTrash: () =>
    withAuthedWorkspace(() => Databases.listTrash).pipe(Effect.orDie),
  restorePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Pages.restorePage(id);
      }),
    ).pipe(Effect.orDie),
  restoreDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.restoreDatabase(id);
      }),
    ).pipe(Effect.orDie),
  restoreRecord: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, id, "editor");
        return yield* Databases.restoreRecord(id);
      }),
    ).pipe(Effect.orDie),
  purgePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Databases.purgePage(id);
      }),
    ).pipe(Effect.orDie),
  purgeDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.purgeDatabase(id);
      }),
    ).pipe(Effect.orDie),
  purgeRecord: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, id, "editor");
        return yield* Databases.purgeRecord(id);
      }),
    ).pipe(Effect.orDie),

  // Workspaces (use PlatformDb, session-based)
  getMyWorkspaces: () => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.getMyWorkspaces(user.id);
  }).pipe(Effect.orDie),
  createWorkspace: ({ name, slug }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    const ws = yield* Workspaces.createWorkspace({ userId: user.id, name, slug });
    // Seed "Getting Started" content; tolerate failures so a broken seed never blocks creation.
    yield* Onboarding.seedStarterContent(ws.id).pipe(
      Effect.catchAll((err) => Effect.logError("seedStarterContent failed", err)),
    );
    track("workspace_created", user.id, { workspace_id: ws.id });
    return ws;
  }).pipe(Effect.orDie),
  joinWorkspaceByToken: ({ inviteToken }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.joinWorkspaceByToken({ userId: user.id, inviteToken });
  }).pipe(Effect.orDie),
  getWorkspaceMembers: ({ workspaceId }) =>
    Workspaces.getWorkspaceMembers(workspaceId).pipe(Effect.orDie),
  removeMember: ({ workspaceId, userId }) =>
    Workspaces.removeMember({ workspaceId, userId }).pipe(Effect.orDie),
  regenerateInviteLink: ({ workspaceId }) =>
    Workspaces.regenerateInviteLink(workspaceId).pipe(Effect.orDie),
  inviteMemberByEmail: ({ workspaceId, email }) => Effect.gen(function* () {
    yield* getSessionUser;
    return yield* Workspaces.inviteMemberByEmail({ workspaceId, email });
  }).pipe(Effect.orDie),

  // API keys
  listApiKeys: () => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.listApiKeys(user.id);
  }).pipe(Effect.orDie),
  createApiKey: ({ name }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.createApiKey({ userId: user.id, name });
  }).pipe(Effect.orDie),
  revokeApiKey: ({ id }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.revokeApiKey({ userId: user.id, id });
  }).pipe(Effect.orDie),

  // Page ACL — Zanzibar-style: structured subjects, atomic writes, revisions.
  listLockedPageIds: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Permissions.listVisibleLockedPageIds(userId, workspaceId, role),
    ).pipe(Effect.orDie),
  getPagePermissions: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Permissions.getPagePermissions(pageId);
      }),
    ).pipe(Effect.orDie),
  checkPagePermission: ({ pageId, relation }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Permissions.canAccessPage(userId, workspaceId, pageId, relation).pipe(
        Effect.map((allowed) => ({ allowed })),
      ),
    ).pipe(Effect.orDie),
  writePagePermissions: ({ pageId, set, remove, ifRevision }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "owner");
        return yield* Permissions.writePagePermissions({
          pageId,
          set,
          remove,
          ifRevision,
        });
      }),
    ).pipe(Effect.orDie),

  // Import/Export
  importNotion: ({ directory }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.requireWorkspaceOwner(userId, workspaceId);
        return yield* ImportExport.importNotion(directory);
      }),
    ).pipe(Effect.orDie),
  exportPage: ({ pageId, includeDatabases }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* ImportExport.exportPage(pageId, includeDatabases);
      }),
    ).pipe(Effect.orDie),
  exportDatabase: ({ dbId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, dbId, "viewer");
        return yield* ImportExport.exportDatabase(dbId);
      }),
    ).pipe(Effect.orDie),
  exportAll: ({ outputDir }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.requireWorkspaceOwner(userId, workspaceId);
        return yield* ImportExport.exportAll(outputDir);
      }),
    ).pipe(Effect.orDie),

  listTemplates: () =>
    withWorkspaceDb(
      Effect.sync(() => Templates.getTemplates()),
    ).pipe(Effect.orDie),

  createPageFromTemplate: (req: { templateId: string; parentId: string | null }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        const page = yield* Templates.createPageFromTemplate(req);
        track("page_created", userId, {
          workspace_id: workspaceId,
          page_id: page.id,
          from_template: req.templateId,
        });
        return page;
      }),
    ).pipe(Effect.orDie),
});
