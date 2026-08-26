/**
 * Lightweight pub/sub for view-config changes.
 *
 * When a view's config (filters, sorts, groupBy, type) is updated, the server
 * publishes an event that all open SSE connections for that view receive,
 * allowing `ViewReferenceBlock` instances to re-apply the new config.
 *
 * The SSE mechanics — framing, keepalive, headers, finalization — live in
 * `sse-channel.ts`; this file supplies only what is specific to view configs:
 * how to authorize a listener and how to attach one to a view's subscriber set.
 */

import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import type { Context } from "effect";
import { Effect, Layer } from "effect";
import type { WorkspaceDb } from "./db.js";
import * as Permissions from "./handlers/permissions.js";
import { PlatformDbLive } from "./platform-db.js";
import { refuse, sseChannel } from "./sse-channel.js";
import { resolveWorkspaceContext } from "./workspace-context.js";

type WorkspaceDbService = Context.Tag.Service<WorkspaceDb>;

export type ViewConfigEvent = {
	type: "view.configChanged";
	viewId: string;
	databaseId: string;
	config: string;
	groupByFieldId: string | null;
	viewType: string;
};

type Subscriber = {
	push: (e: ViewConfigEvent) => void;
};

const subscribers = new Map<string, Set<Subscriber>>();
const key = (dbId: string, viewId: string) => `${dbId}::${viewId}`;

/** Notify all subscribers that a view's config changed. */
export function publishViewConfigChange(event: ViewConfigEvent) {
	const k = key(event.databaseId, event.viewId);
	const subs = subscribers.get(k);
	if (!subs) return;
	const dead: Subscriber[] = [];
	for (const s of subs) {
		try {
			s.push(event);
		} catch {
			dead.push(s);
		}
	}
	if (dead.length > 0) {
		for (const d of dead) subs.delete(d);
		if (subs.size === 0) subscribers.delete(k);
	}
}

/**
 * SSE handler: `GET /api/stream/view-config?databaseId=…&viewId=…`
 *
 * Subscribes the caller to config changes for the given view.
 *
 * Follows `presence/routes.ts` `makeStreamHandler`: session, then membership of
 * the named workspace, then a view-level permission check. EventSource cannot
 * send custom headers, so the workspace arrives as a query param and is proven
 * here rather than through `withAuthedWorkspace`.
 */
export function makeViewConfigStreamHandler(wdb: WorkspaceDbService) {
	return sseChannel<{ databaseId: string; viewId: string }>({
		name: "view-config",
		authorize: Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const url = new URL(req.url, "http://localhost");
			const databaseId = url.searchParams.get("databaseId");
			const viewId = url.searchParams.get("viewId");
			const workspaceId = url.searchParams.get("workspaceId");
			if (!databaseId || !viewId || !workspaceId) {
				return yield* refuse(400, "Missing databaseId, viewId or workspaceId");
			}

			// EventSource cannot send headers, so the workspace arrives as a query
			// param and is proven here rather than through withAuthedWorkspace.
			const ctx = yield* Effect.either(
				resolveWorkspaceContext(workspaceId).pipe(
					Effect.provide(PlatformDbLive),
				),
			);
			if (ctx._tag === "Left") {
				return yield* refuse(ctx.left.status, ctx.left.message);
			}

			const allowed = yield* Effect.either(
				Permissions.checkViewPermission(
					ctx.right.userId,
					workspaceId,
					viewId,
					"viewer",
				).pipe(
					Effect.provide(
						Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive),
					),
				),
			);
			if (allowed._tag === "Left") return yield* refuse(403, "Forbidden");

			return { databaseId, viewId };
		}),
		subscribe: ({ databaseId, viewId }, send) => {
			const sub: Subscriber = { push: (e) => send(e) };
			const k = key(databaseId, viewId);
			let set = subscribers.get(k);
			if (!set) {
				set = new Set();
				subscribers.set(k, set);
			}
			set.add(sub);

			return () => {
				set.delete(sub);
				if (set.size === 0) subscribers.delete(k);
			};
		},
	});
}
