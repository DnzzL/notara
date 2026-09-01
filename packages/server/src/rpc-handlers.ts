/**
 * RPC handler wiring — maps AppRpc method tags to Effect closures that compose
 * auth, permission checks, handler calls, presence broadcasts, and analytics
 * tracking. Extracted from index.ts to keep infrastructure wiring separate from
 * RPC routing.
 */

import {
	type ApiError,
	AppRpc,
	BlockLockedError,
	isApiError,
	RecordFieldValue,
} from "@notara/shared";
import { Effect } from "effect";
import * as ApiKeys from "./handlers/api-keys.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import * as ImportExport from "./handlers/importExport.js";
import * as Onboarding from "./handlers/onboarding.js";
import * as PageShares from "./handlers/page-shares.js";
import * as Pages from "./handlers/pages.js";
import * as Permissions from "./handlers/permissions.js";
import * as Search from "./handlers/search.js";
import * as Templates from "./handlers/templates.js";
import * as Workspaces from "./handlers/workspaces.js";
import { track } from "./observability.js";
import { presence } from "./presence/index.js";
import {
	getSessionUser,
	requireWorkspaceOwner,
	requireWorkspaceRole,
	withAuthedWorkspace,
} from "./workspace-context.js";

/**
 * Keep the API's declared failures (`error: ApiError` on every RPC) in the error
 * channel so they cross the boundary decoded and the client can switch on
 * `_tag`. Everything else — SQL errors, missing headers, bugs — becomes a defect,
 * exactly as the previous blanket `Effect.orDie` did: those are incidents, not
 * answers, and the client only needs "something went wrong" for them.
 */
export const dieUnlessApiError = <A, E, R>(
	self: Effect.Effect<A, E, R>,
): Effect.Effect<A, ApiError, R> =>
	Effect.catch(self, (error) =>
		isApiError(error) ? Effect.fail(error) : Effect.die(error),
	);

export const rpcHandlersLayer = AppRpc.toLayer({
	listPages: () =>
		withAuthedWorkspace(({ userId, workspaceId, role }) =>
			Effect.gen(function* () {
				const all = yield* Pages.listPages;
				return yield* Permissions.filterPagesByPermission(
					userId,
					workspaceId,
					role,
					all,
				);
			}),
		).pipe(dieUnlessApiError),
	getPage: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					id,
					"viewer",
				);
				return yield* Pages.getPage(id);
			}),
		).pipe(dieUnlessApiError),
	createPage: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				const page = yield* Pages.createPage(req);
				track("page_created", userId, {
					workspace_id: workspaceId,
					page_id: page.id,
				});
				return page;
			}),
		).pipe(dieUnlessApiError),
	updatePage: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				const page = yield* Pages.updatePage(req);
				presence.broadcast(workspaceId, req.id, {
					type: "page.metaUpdated",
					actorUserId: userId,
					fields: {
						title: page.title,
						icon: page.icon,
						coverUrl: page.coverUrl,
					},
				});
				return page;
			}),
		).pipe(dieUnlessApiError),
	deletePage: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Pages.deletePage(id);
			}),
		).pipe(dieUnlessApiError),
	globalSearch: ({ query }) =>
		withAuthedWorkspace(({ userId, workspaceId, role }) =>
			Effect.gen(function* () {
				const results = yield* Search.globalSearch(query);
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					userId,
					workspaceId,
					role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				return results.filter((r) =>
					visibleIds.has(r.type === "page" ? r.id : r.pageId),
				);
			}),
		).pipe(dieUnlessApiError),
	movePage: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				return yield* Pages.movePage(req);
			}),
		).pipe(dieUnlessApiError),
	reorderPages: ({ parentId, pageIds }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				if (parentId !== null) {
					yield* Permissions.checkPagePermission(
						userId,
						workspaceId,
						parentId,
						"editor",
					);
				}
				return yield* Pages.reorderPages({ parentId, pageIds: [...pageIds] });
			}),
		).pipe(dieUnlessApiError),

	listBlocks: ({ pageId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"viewer",
				);
				return yield* Blocks.listBlocks(pageId);
			}),
		).pipe(dieUnlessApiError),
	createBlock: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					req.pageId,
					"editor",
				);
				const block = yield* Blocks.createBlock(req);
				presence.broadcast(workspaceId, req.pageId, {
					type: "block.created",
					actorUserId: userId,
					block,
				});
				return block;
			}),
		).pipe(dieUnlessApiError),
	updateBlock: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkBlockPermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				const pageId = yield* Blocks.getBlockPageId(req.id);
				if (pageId) {
					const holder = presence.lockHolder(workspaceId, pageId, req.id);
					if (holder && holder !== userId) {
						return yield* Effect.fail(
							new BlockLockedError({ holderUserId: holder }),
						);
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
		).pipe(dieUnlessApiError),
	deleteBlock: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkBlockPermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				const pageId = yield* Blocks.getBlockPageId(id);
				if (pageId) {
					const holder = presence.lockHolder(workspaceId, pageId, id);
					if (holder && holder !== userId) {
						return yield* Effect.fail(
							new BlockLockedError({ holderUserId: holder }),
						);
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
		).pipe(dieUnlessApiError),
	reorderBlocks: ({ pageId, blockIds }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"editor",
				);
				const result = yield* Blocks.reorderBlocks(pageId, [...blockIds]);
				presence.broadcast(workspaceId, pageId, {
					type: "block.reordered",
					actorUserId: userId,
					blockIds: [...blockIds],
				});
				return result;
			}),
		).pipe(dieUnlessApiError),
	getBacklinks: ({ pageId }) =>
		withAuthedWorkspace(({ userId, workspaceId, role }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"viewer",
				);
				const all = yield* Blocks.getBacklinks(pageId);
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					userId,
					workspaceId,
					role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				return all.filter((b) => visibleIds.has(b.pageId));
			}),
		).pipe(dieUnlessApiError),

	listDatabases: ({ pageId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"viewer",
				);
				return yield* Databases.listDatabases(pageId);
			}),
		).pipe(dieUnlessApiError),
	listAllDatabases: () =>
		withAuthedWorkspace(({ userId, workspaceId, role }) =>
			Effect.gen(function* () {
				const all = yield* Databases.listAllDatabases;
				const allPages = yield* Pages.listPages;
				const visible = yield* Permissions.filterPagesByPermission(
					userId,
					workspaceId,
					role,
					allPages,
				);
				const visibleIds = new Set(visible.map((p) => p.id));
				return all.filter((db) => visibleIds.has(db.pageId));
			}),
		).pipe(dieUnlessApiError),
	getDatabase: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					id,
					"viewer",
				);
				return yield* Databases.getDatabase(id);
			}),
		).pipe(dieUnlessApiError),
	createDatabase: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					req.pageId,
					"editor",
				);
				return yield* Databases.createDatabase(req);
			}),
		).pipe(dieUnlessApiError),
	listFields: ({ databaseId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					databaseId,
					"viewer",
				);
				return yield* Databases.listFields(databaseId);
			}),
		).pipe(dieUnlessApiError),
	createField: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					req.databaseId,
					"editor",
				);
				return yield* Databases.createField({
					databaseId: req.databaseId,
					name: req.name,
					type: req.type,
					options: req.options ? [...req.options] : null,
					relationTargetDbId: req.relationTargetDbId,
					formula: req.formula ?? null,
					syncLinkedRow: req.syncLinkedRow,
				});
			}),
		).pipe(dieUnlessApiError),
	listRecords: ({ databaseId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					databaseId,
					"viewer",
				);
				return yield* Databases.listRecords(databaseId);
			}),
		).pipe(dieUnlessApiError),
	listRecordsWithValues: ({ databaseId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					databaseId,
					"viewer",
				);
				return yield* Databases.listRecordsWithValues(databaseId);
			}),
		).pipe(dieUnlessApiError),
	getRecordWithValues: ({ recordId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkRecordPermission(
					userId,
					workspaceId,
					recordId,
					"viewer",
				);
				return yield* Databases.getRecordWithValues(recordId);
			}),
		).pipe(dieUnlessApiError),
	createRecord: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					req.databaseId,
					"editor",
				);
				return yield* Databases.createRecord(req);
			}),
		).pipe(dieUnlessApiError),
	updateFieldValue: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkRecordPermission(
					userId,
					workspaceId,
					req.recordId,
					"editor",
				);
				const row = yield* Databases.updateFieldValue(req);
				return new RecordFieldValue({
					id: row.id as string,
					recordId: row.recordId as string,
					fieldId: row.fieldId as string,
					value: row.value as string,
				});
			}),
		).pipe(dieUnlessApiError),
	deleteRecord: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkRecordPermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.deleteRecord(id);
			}),
		).pipe(dieUnlessApiError),
	listViews: ({ databaseId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					databaseId,
					"viewer",
				);
				return yield* Databases.listViews(databaseId);
			}),
		).pipe(dieUnlessApiError),
	createView: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					req.databaseId,
					"editor",
				);
				return yield* Databases.createView({
					databaseId: req.databaseId,
					name: req.name,
					type: req.type,
					groupByFieldId: req.groupByFieldId,
					config: req.config,
					isDefault: req.isDefault,
				});
			}),
		).pipe(dieUnlessApiError),
	updateView: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkViewPermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				return yield* Databases.updateView({
					id: req.id,
					name: req.name,
					type: req.type,
					groupByFieldId: req.groupByFieldId,
					config: req.config,
					isDefault: req.isDefault,
				});
			}),
		).pipe(dieUnlessApiError),
	deleteView: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkViewPermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.deleteView(id);
			}),
		).pipe(dieUnlessApiError),
	updateField: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkFieldPermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				return yield* Databases.updateField({
					id: req.id,
					name: req.name,
					type: req.type,
					options:
						req.options === undefined
							? undefined
							: req.options
								? [...req.options]
								: null,
					relationTargetDbId: req.relationTargetDbId,
					formula: req.formula,
					syncLinkedRow: req.syncLinkedRow,
				});
			}),
		).pipe(dieUnlessApiError),
	reorderFields: ({ databaseId, fieldIds }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					databaseId,
					"editor",
				);
				return yield* Databases.reorderFields({
					databaseId,
					fieldIds: [...fieldIds],
				});
			}),
		).pipe(dieUnlessApiError),
	updateRecord: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkRecordPermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				return yield* Databases.updateRecord(req);
			}),
		).pipe(dieUnlessApiError),
	reorderRecords: ({ databaseId, recordIds }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					databaseId,
					"editor",
				);
				return yield* Databases.reorderRecords({
					databaseId,
					recordIds: [...recordIds],
				});
			}),
		).pipe(dieUnlessApiError),
	openRecordAsPage: ({ recordId }) =>
		withAuthedWorkspace(() => Databases.openRecordAsPage(recordId)).pipe(
			dieUnlessApiError,
		),
	renameDatabase: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				return yield* Databases.renameDatabase({ id: req.id, name: req.name });
			}),
		).pipe(dieUnlessApiError),
	updateDatabase: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					req.id,
					"editor",
				);
				return yield* Databases.updateDatabase(req);
			}),
		).pipe(dieUnlessApiError),
	deleteField: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkFieldPermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.deleteField(id);
			}),
		).pipe(dieUnlessApiError),
	reorderDatabases: (req) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					req.pageId,
					"editor",
				);
				return yield* Databases.reorderDatabases({
					pageId: req.pageId,
					databaseIds: [...req.databaseIds],
				});
			}),
		).pipe(dieUnlessApiError),
	deleteDatabase: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.deleteDatabase(id);
			}),
		).pipe(dieUnlessApiError),

	// Trash: list / restore / permanent purge
	listTrash: () =>
		withAuthedWorkspace(() => Databases.listTrash).pipe(dieUnlessApiError),
	restorePage: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Pages.restorePage(id);
			}),
		).pipe(dieUnlessApiError),
	restoreDatabase: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.restoreDatabase(id);
			}),
		).pipe(dieUnlessApiError),
	restoreRecord: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkRecordPermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.restoreRecord(id);
			}),
		).pipe(dieUnlessApiError),
	purgePage: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.purgePage(id);
			}),
		).pipe(dieUnlessApiError),
	purgeDatabase: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.purgeDatabase(id);
			}),
		).pipe(dieUnlessApiError),
	purgeRecord: ({ id }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkRecordPermission(
					userId,
					workspaceId,
					id,
					"editor",
				);
				return yield* Databases.purgeRecord(id);
			}),
		).pipe(dieUnlessApiError),

	// Workspaces (use PlatformDb, session-based)
	getMyWorkspaces: () =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			return yield* Workspaces.getMyWorkspaces(user.id);
		}).pipe(dieUnlessApiError),
	createWorkspace: ({ name, slug }) =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			const ws = yield* Workspaces.createWorkspace({
				userId: user.id,
				name,
				slug,
			});
			// Seed "Getting Started" content; tolerate failures so a broken seed never blocks creation.
			yield* Onboarding.seedStarterContent(ws.id).pipe(
				Effect.catch((err) =>
					Effect.logError("seedStarterContent failed", err),
				),
			);
			track("workspace_created", user.id, { workspace_id: ws.id });
			return ws;
		}).pipe(dieUnlessApiError),
	joinWorkspaceByToken: ({ inviteToken }) =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			return yield* Workspaces.joinWorkspaceByToken({
				userId: user.id,
				inviteToken,
			});
		}).pipe(dieUnlessApiError),
	startDemo: () =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			const { workspace, created } = yield* Workspaces.startDemo(user.id);
			if (created) {
				// Same tolerant seeding as createWorkspace: an unseeded demo is still usable.
				yield* Onboarding.seedStarterContent(workspace.id).pipe(
					Effect.catch((err) =>
						Effect.logError("seedStarterContent failed", err),
					),
				);
			}
			return workspace;
		}).pipe(dieUnlessApiError),
	getWorkspaceMembers: ({ workspaceId }) =>
		Effect.gen(function* () {
			yield* requireWorkspaceRole(workspaceId);
			return yield* Workspaces.getWorkspaceMembers(workspaceId);
		}).pipe(dieUnlessApiError),
	removeMember: ({ workspaceId, userId }) =>
		Effect.gen(function* () {
			yield* requireWorkspaceOwner(workspaceId);
			return yield* Workspaces.removeMember({ workspaceId, userId });
		}).pipe(dieUnlessApiError),
	regenerateInviteLink: ({ workspaceId }) =>
		Effect.gen(function* () {
			yield* requireWorkspaceOwner(workspaceId);
			return yield* Workspaces.regenerateInviteLink(workspaceId);
		}).pipe(dieUnlessApiError),
	inviteMemberByEmail: ({ workspaceId, email }) =>
		Effect.gen(function* () {
			// Owner, not just any session: the mail carries the workspace invite
			// token, so sending it is the same capability as regenerateInviteLink
			// above. Matches the settings panel, which only renders this form to
			// the owner.
			yield* requireWorkspaceOwner(workspaceId);
			return yield* Workspaces.inviteMemberByEmail({ workspaceId, email });
		}).pipe(dieUnlessApiError),

	// API keys
	listApiKeys: () =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			return yield* ApiKeys.listApiKeys(user.id);
		}).pipe(dieUnlessApiError),
	createApiKey: ({ name, scope }) =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			return yield* ApiKeys.createApiKey({ userId: user.id, name, scope });
		}).pipe(dieUnlessApiError),
	revokeApiKey: ({ id }) =>
		Effect.gen(function* () {
			const user = yield* getSessionUser;
			return yield* ApiKeys.revokeApiKey({ userId: user.id, id });
		}).pipe(dieUnlessApiError),

	// Page ACL — Zanzibar-style: structured subjects, atomic writes, revisions.
	listLockedPageIds: () =>
		withAuthedWorkspace(({ userId, workspaceId, role }) =>
			Permissions.listVisibleLockedPageIds(userId, workspaceId, role),
		).pipe(dieUnlessApiError),
	getPageShare: ({ pageId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				// Editor, not viewer: knowing whether a page is on the open web is
				// part of controlling it, and the toggle sits beside this reading.
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"editor",
				);
				return yield* PageShares.get(workspaceId, pageId);
			}),
		).pipe(dieUnlessApiError),
	setPageSharing: ({ pageId, enabled }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"editor",
				);
				if (!enabled) {
					yield* PageShares.disable(workspaceId, pageId);
					return null;
				}
				return yield* PageShares.enable(workspaceId, pageId, userId);
			}),
		).pipe(dieUnlessApiError),
	getPagePermissions: ({ pageId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"viewer",
				);
				return yield* Permissions.getPagePermissions(pageId);
			}),
		).pipe(dieUnlessApiError),
	checkPagePermission: ({ pageId, relation }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Permissions.canAccessPage(userId, workspaceId, pageId, relation).pipe(
				Effect.map((allowed) => ({ allowed })),
			),
		).pipe(dieUnlessApiError),
	writePagePermissions: ({ pageId, set, remove, ifRevision }) =>
		withAuthedWorkspace(({ userId, workspaceId, role }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"owner",
				);
				return yield* Permissions.writePagePermissions({
					pageId,
					set,
					remove,
					ifRevision,
					callerWorkspaceRole: role,
				});
			}),
		).pipe(dieUnlessApiError),

	// Import/Export
	importNotion: ({ directory }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.requireWorkspaceOwner(userId, workspaceId);
				return yield* ImportExport.importNotion(directory);
			}),
		).pipe(dieUnlessApiError),
	exportPage: ({ pageId, includeDatabases }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkPagePermission(
					userId,
					workspaceId,
					pageId,
					"viewer",
				);
				return yield* ImportExport.exportPage(pageId, includeDatabases);
			}),
		).pipe(dieUnlessApiError),
	exportDatabase: ({ dbId }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.checkDatabasePermission(
					userId,
					workspaceId,
					dbId,
					"viewer",
				);
				return yield* ImportExport.exportDatabase(dbId);
			}),
		).pipe(dieUnlessApiError),
	exportAll: ({ outputDir }) =>
		withAuthedWorkspace(({ userId, workspaceId }) =>
			Effect.gen(function* () {
				yield* Permissions.requireWorkspaceOwner(userId, workspaceId);
				return yield* ImportExport.exportAll(outputDir);
			}),
		).pipe(dieUnlessApiError),

	// Built-in templates are a static catalogue, not workspace data. This used to
	// run through withWorkspaceDb, which opened a workspace layer named by an
	// unauthenticated client header — for a value that never touched a database.
	listTemplates: () =>
		Effect.gen(function* () {
			yield* getSessionUser;
			return Templates.getTemplates();
		}).pipe(dieUnlessApiError),

	createPageFromTemplate: (req: {
		templateId: string;
		parentId: string | null;
	}) =>
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
		).pipe(dieUnlessApiError),
});
