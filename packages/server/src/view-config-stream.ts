/**
 * Lightweight pub/sub for view-config changes.
 *
 * When a view's config (filters, sorts, groupBy, type) is updated, the server
 * publishes an event that all open SSE connections for that view receive,
 * allowing `ViewReferenceBlock` instances to re-apply the new config.
 *
 * Pattern mirrors `presence/PresenceService.ts` but is simpler — no TTL,
 * no heartbeat — because the subscriber list is tied to EventSource lifetime
 * and cleaned up when the TCP connection drops.
 */

import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import type { Context } from "effect";
import { Effect, Layer, Stream } from "effect";
import type { WorkspaceDb } from "./db.js";
import * as Permissions from "./handlers/permissions.js";
import { PlatformDbLive } from "./platform-db.js";
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
	return Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const url = new URL(req.url, "http://localhost");
		const databaseId = url.searchParams.get("databaseId");
		const viewId = url.searchParams.get("viewId");
		const workspaceId = url.searchParams.get("workspaceId");
		if (!databaseId || !viewId || !workspaceId) {
			return HttpServerResponse.text(
				JSON.stringify({
					error: "Missing databaseId, viewId or workspaceId",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const ctx = yield* Effect.either(
			resolveWorkspaceContext(workspaceId).pipe(Effect.provide(PlatformDbLive)),
		);
		if (ctx._tag === "Left") {
			return HttpServerResponse.text(
				JSON.stringify({ error: ctx.left.message }),
				{
					status: ctx.left.status,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const permCheck = yield* Effect.either(
			Permissions.checkViewPermission(
				ctx.right.userId,
				workspaceId,
				viewId,
				"viewer",
			).pipe(
				Effect.provide(Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive)),
			),
		);
		if (permCheck._tag === "Left") {
			return HttpServerResponse.text(JSON.stringify({ error: "Forbidden" }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}

		const encoder = new TextEncoder();
		const encodeEvent = (e: ViewConfigEvent) =>
			encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);

		const sseStream = Stream.async<Uint8Array>((emit) => {
			const sub: Subscriber = {
				push: (e: ViewConfigEvent) => {
					emit.single(encodeEvent(e));
				},
			};
			const k = key(databaseId, viewId);
			let set = subscribers.get(k);
			if (!set) {
				set = new Set();
				subscribers.set(k, set);
			}
			set.add(sub);

			// Keepalive ping every 30s
			const keepAlive = setInterval(
				() => emit.single(encoder.encode(": ping\n\n")),
				30_000,
			);

			return Effect.sync(() => {
				clearInterval(keepAlive);
				set?.delete(sub);
				if (set?.size === 0) subscribers.delete(k);
			});
		});

		return HttpServerResponse.stream(sseStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
				"Access-Control-Allow-Origin": process.env.BASE_URL ?? "*",
				Vary: "Origin",
			},
		});
	}).pipe(
		Effect.catchAllCause((cause) =>
			Effect.zipRight(
				Effect.logError("view-config stream failed", cause),
				Effect.succeed(
					HttpServerResponse.text(JSON.stringify({ error: "Server error" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
				),
			),
		),
	);
}
