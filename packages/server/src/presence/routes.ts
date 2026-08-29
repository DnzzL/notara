import type { Context } from "effect";
import { Effect, Layer } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { auth } from "../auth.js";
import type { WorkspaceDb } from "../db.js";
import * as Permissions from "../handlers/permissions.js";
import { PlatformDbLive } from "../platform-db.js";
import { refuse, sseChannel } from "../sse-channel.js";
import { presence } from "./index.js";

type WorkspaceDbService = Context.Service.Shape<typeof WorkspaceDb>;

const corsBase = {
	"Access-Control-Allow-Origin": process.env.BASE_URL ?? "*",
	Vary: "Origin",
};

function jsonResponse(body: unknown, status = 200) {
	return HttpServerResponse.text(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...corsBase },
	});
}

function toHeaders(raw: Record<string, string | string[] | undefined>) {
	const h = new Headers();
	for (const [k, v] of Object.entries(raw)) {
		if (typeof v === "string") h.set(k, v);
	}
	return h;
}

/** POST /api/presence/heartbeat — body: { workspaceId, pageId, focusedBlockId } */
export const makeHeartbeatHandler = (wdb: WorkspaceDbService) =>
	Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const headers = toHeaders(
			req.headers as Record<string, string | string[] | undefined>,
		);
		const session = yield* Effect.promise(() =>
			auth.api.getSession({ headers }),
		);
		if (!session) return jsonResponse({ error: "Unauthorized" }, 401);

		const ab = yield* req.arrayBuffer;
		let body: {
			workspaceId?: string;
			pageId?: string;
			focusedBlockId?: string | null;
		};
		try {
			body = JSON.parse(Buffer.from(ab).toString("utf-8"));
		} catch {
			return jsonResponse({ error: "Invalid JSON" }, 400);
		}
		const { workspaceId, pageId } = body;
		if (!workspaceId || !pageId)
			return jsonResponse({ error: "Missing workspaceId or pageId" }, 400);

		const permCheck = yield* Effect.result(
			Permissions.checkPagePermission(
				session.user.id,
				workspaceId,
				pageId,
				"viewer",
			).pipe(
				Effect.provide(Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive)),
			),
		);
		if (permCheck._tag === "Failure")
			return jsonResponse({ error: "Forbidden" }, 403);

		presence.heartbeat({
			workspaceId,
			pageId,
			user: {
				id: session.user.id,
				name: session.user.name ?? session.user.email ?? "Anonymous",
			},
			focusedBlockId: body.focusedBlockId ?? null,
		});

		return jsonResponse({
			presence: presence
				.presence(workspaceId, pageId)
				.filter((p) => p.userId !== session.user.id),
		});
	}).pipe(
		Effect.catchCause((cause) =>
			Effect.andThen(
				Effect.logError("presence route failed", cause),
				Effect.succeed(jsonResponse({ error: "Server error" }, 500)),
			),
		),
	);

/**
 * POST /api/presence/leave — body: { workspaceId, pageId }
 *
 * Sent by the client when it stops watching a page. Removing your own presence
 * needs no page permission check beyond having a session.
 */
export const leaveHandler = Effect.gen(function* () {
	const req = yield* HttpServerRequest.HttpServerRequest;
	const headers = toHeaders(
		req.headers as Record<string, string | string[] | undefined>,
	);
	const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
	if (!session) return jsonResponse({ error: "Unauthorized" }, 401);

	const ab = yield* req.arrayBuffer;
	let body: { workspaceId?: string; pageId?: string };
	try {
		body = JSON.parse(Buffer.from(ab).toString("utf-8"));
	} catch {
		return jsonResponse({ error: "Invalid JSON" }, 400);
	}
	const { workspaceId, pageId } = body;
	if (!workspaceId || !pageId)
		return jsonResponse({ error: "Missing workspaceId or pageId" }, 400);

	presence.leave(workspaceId, pageId, session.user.id);
	return jsonResponse({ ok: true });
}).pipe(
	Effect.catchCause((cause) =>
		Effect.andThen(
			Effect.logError("presence route failed", cause),
			Effect.succeed(jsonResponse({ error: "Server error" }, 500)),
		),
	),
);

/** GET /api/presence/stream?workspaceId=…&pageId=… — SSE */
export const makeStreamHandler = (wdb: WorkspaceDbService) =>
	sseChannel<{ workspaceId: string; pageId: string; userId: string }>({
		name: "presence",
		authorize: Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const headers = toHeaders(
				req.headers as Record<string, string | string[] | undefined>,
			);
			const session = yield* Effect.promise(() =>
				auth.api.getSession({ headers }),
			);
			if (!session) return yield* refuse(401, "Unauthorized");

			const url = new URL(req.url, "http://localhost");
			const workspaceId = url.searchParams.get("workspaceId");
			const pageId = url.searchParams.get("pageId");
			if (!workspaceId || !pageId)
				return yield* refuse(400, "Missing query params");

			const allowed = yield* Effect.result(
				Permissions.checkPagePermission(
					session.user.id,
					workspaceId,
					pageId,
					"viewer",
				).pipe(
					Effect.provide(
						Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive),
					),
				),
			);
			if (allowed._tag === "Failure") return yield* refuse(403, "Forbidden");

			return { workspaceId, pageId, userId: session.user.id };
		}),
		// A new subscriber starts populated rather than waiting for the first
		// change to learn who else is here.
		initial: ({ workspaceId, pageId }) => ({
			type: "presence.changed",
			users: presence.presence(workspaceId, pageId),
		}),
		subscribe: ({ workspaceId, pageId, userId }, send) =>
			presence.subscribe(workspaceId, pageId, userId, send),
	});
