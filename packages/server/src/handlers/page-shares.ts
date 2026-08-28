/**
 * Publishing a page as a read-only public link.
 *
 * This module owns the CAPABILITY and nothing else: minting a token, resolving
 * one back to the page it names, and revoking it. It deliberately does not
 * decide whether the page behind a token may still be read — that needs the
 * workspace DB and the ACL, and asking it here would drag both into a module
 * whose whole job is a lookup in the platform DB.
 *
 * The split is what makes the serving route honest. It resolves the token to a
 * (workspace, page, publisher) triple, then asks the ACL whether the publisher
 * can still read that page. A capability delegated by a person does not
 * outlive that person's own access, so locking a page cuts every link
 * published from it without anyone having to remember the links exist.
 *
 * See migration platform/005 for why this is a table of its own rather than an
 * acl_tuple with a `public` subject.
 */
import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import { PlatformDb } from "../platform-db.js";

/** Where a token points. */
export type Share = {
	workspaceId: string;
	pageId: string;
	/** Who published it. Their access is re-checked on every read. */
	sharedBy: string;
};

/**
 * A token is the entire credential — there is nothing else to present — so it
 * is 192 bits of CSPRNG output, not a ULID. The invite token is a ULID and can
 * be so because you also have to be signed in to redeem it; a share token
 * cannot, since a ULID's leading characters are just the millisecond it was
 * minted.
 */
const mintToken = () => randomBytes(24).toString("base64url");

/**
 * Publish a page, or return the token it is already published under.
 *
 * Idempotent by design: two live links to one page would make revoking
 * ambiguous — disabling would silently leave the other one working. Re-enabling
 * keeps the original publisher, so it cannot be used to re-point an existing
 * link at someone else's access.
 */
export const enable = (
	workspaceId: string,
	pageId: string,
	userId: string,
): Effect.Effect<string, never, PlatformDb> =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const existing = db
			.prepare(
				"SELECT token FROM page_shares WHERE workspace_id = ? AND page_id = ?",
			)
			.get(workspaceId, pageId) as { token: string } | null;
		if (existing) return existing.token;

		const token = mintToken();
		db.prepare(
			"INSERT INTO page_shares (token, workspace_id, page_id, shared_by, created_at) VALUES (?, ?, ?, ?, ?)",
		).run(token, workspaceId, pageId, userId, new Date().toISOString());
		return token;
	});

/** The token this page is published under, or null if it is not. */
export const get = (
	workspaceId: string,
	pageId: string,
): Effect.Effect<string | null, never, PlatformDb> =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const row = db
			.prepare(
				"SELECT token FROM page_shares WHERE workspace_id = ? AND page_id = ?",
			)
			.get(workspaceId, pageId) as { token: string } | null;
		return row?.token ?? null;
	});

/**
 * Withdraw the page.
 *
 * Deleting the row rather than flagging it is what makes revocation final: a
 * re-enable mints a fresh token, so a link handed out and taken back cannot
 * come alive again. Doing nothing on an unshared page is not an error — the UI
 * toggles this, and a double-off must not be a failure to report.
 */
export const disable = (
	workspaceId: string,
	pageId: string,
): Effect.Effect<void, never, PlatformDb> =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		db.prepare(
			"DELETE FROM page_shares WHERE workspace_id = ? AND page_id = ?",
		).run(workspaceId, pageId);
	});

/**
 * What a token names, or null if it names nothing.
 *
 * Null covers "never minted" and "revoked" alike — the caller turns both into
 * the same 404, which is the only answer that does not tell a stranger whether
 * a page exists.
 */
export const resolveToken = (
	token: string,
): Effect.Effect<Share | null, never, PlatformDb> =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const row = db
			.prepare(
				"SELECT workspace_id, page_id, shared_by FROM page_shares WHERE token = ?",
			)
			.get(token) as {
			workspace_id: string;
			page_id: string;
			shared_by: string;
		} | null;
		if (!row) return null;
		return {
			workspaceId: row.workspace_id,
			pageId: row.page_id,
			sharedBy: row.shared_by,
		};
	});
