/**
 * Every user-facing app action (an RPC the UI calls) has an operation in the
 * typed operation table (NOT-171), so anything a person can do in the UI, an
 * agent can do over REST / MCP / CLI.
 *
 * An RPC is covered when an operation carries its name, or when `RENAMED`
 * points it at the operation that does the same job. Otherwise it must sit in
 * `NOT_AN_OPERATION` with a reason. Adding an RPC to `AppRpc` without doing
 * one of the two turns this test red. Coverage is by name only: it cannot see
 * an operation whose input is narrower than the RPC (allowlist those as TODO). Entries marked `TODO: missing operation`
 * are real gaps, not decisions.
 */
import { describe, expect, test } from "bun:test";
import { AppRpc } from "@notara/shared";
import { typedOperations } from "../src/api-v1/operations.js";

/** RPC name -> operationId, where the two names differ. */
const RENAMED: Record<string, string> = {
	globalSearch: "search",
	getMyWorkspaces: "listWorkspaces",
	listAllDatabases: "listDatabases",
	listRecords: "listDatabaseRecords",
	listRecordsWithValues: "listDatabaseRecords",
	updateFieldValue: "setCell",
	renameDatabase: "updateDatabase",
	purgePage: "deletePage", // ?permanent=true
	purgeDatabase: "deleteDatabase", // ?permanent=true
	purgeRecord: "deleteRecord", // ?permanent=true
};

/** The one allowlist: RPCs with no operation, and why. */
const NOT_AN_OPERATION: Record<string, string> = {
	// Real user-facing gaps today.
	// Same name as an operation, but the RPC does more: the op lacks `type` (turn-into).
	updateBlock: "TODO: missing operation (block type change)",
	movePage: "TODO: missing operation",
	reorderPages: "TODO: missing operation",
	reorderBlocks: "TODO: missing operation",
	reorderFields: "TODO: missing operation",
	reorderRecords: "TODO: missing operation",
	reorderDatabases: "TODO: missing operation",
	getBacklinks: "TODO: missing operation",
	createWorkspace: "TODO: missing operation",
	getWorkspaceMembers: "TODO: missing operation",
	removeMember: "TODO: missing operation",
	inviteMemberByEmail: "TODO: missing operation",
	regenerateInviteLink: "TODO: missing operation",
	joinWorkspaceByToken: "TODO: missing operation",
	getPageShare: "TODO: missing operation",
	setPageSharing: "TODO: missing operation",
	getPagePermissions: "TODO: missing operation",
	writePagePermissions: "TODO: missing operation",
	listTemplates: "TODO: missing operation",
	createPageFromTemplate: "TODO: missing operation",
	importNotion: "TODO: missing operation",
	exportPage: "TODO: missing operation",
	exportDatabase: "TODO: missing operation",
	exportAll: "TODO: missing operation",
	// Not for agents.
	startDemo:
		"demo-session bootstrap for anonymous visitors, not a workspace action",
	listApiKeys:
		"key management is a human session action; an API key must not mint keys",
	createApiKey:
		"key management is a human session action; an API key must not mint keys",
	revokeApiKey:
		"key management is a human session action; an API key must not mint keys",
	// UI plumbing.
	checkPagePermission:
		"UI-only permission probe; operations enforce permissions themselves",
	listLockedPageIds:
		"UI-only; drives lock icons, operations return BlockLockedError",
};

const operationIds = new Set(typedOperations.map((op) => op.operationId));
const rpcNames = [...AppRpc.requests.keys()];

describe("every app action has an operation", () => {
	test("each RPC has an operationId, or an allowlist entry with a reason", () => {
		const uncovered = rpcNames.filter(
			(rpc) => !operationIds.has(RENAMED[rpc] ?? rpc) && !NOT_AN_OPERATION[rpc],
		);
		expect(uncovered).toEqual([]);
	});

	test("the allowlist and rename map stay honest", () => {
		const names = new Set(rpcNames);
		const stale = [
			...Object.keys(NOT_AN_OPERATION).filter(
				(rpc) => !names.has(rpc) || rpc in RENAMED,
			),
			...Object.keys(RENAMED).filter(
				(rpc) => !names.has(rpc) || !operationIds.has(RENAMED[rpc] ?? ""),
			),
		];
		expect(stale).toEqual([]);
	});
});
