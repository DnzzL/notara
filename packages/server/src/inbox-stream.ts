/**
 * Live unread counts for the inbox: `GET /api/stream/inbox?workspaceId=…`.
 *
 * The SSE mechanics live in `sse-channel.ts`; this file supplies who may listen
 * (the signed-in member, for their own inbox) and the subscriber set, keyed by
 * workspace and user. In-process, like presence: mono-instance by design.
 */

import type { Context } from "effect";
import { Effect, Layer } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import type { WorkspaceDb } from "./db.js";
import { unreadCount } from "./handlers/inbox.js";
import { PlatformDbLive } from "./platform-db.js";
import { refuse, sseChannel, subscriberSet } from "./sse-channel.js";
import { resolveWorkspaceContext } from "./workspace-context.js";

type WorkspaceDbService = Context.Service.Shape<typeof WorkspaceDb>;

export type InboxEvent = { type: "inbox.unread"; count: number };

const listeners = subscriberSet<InboxEvent>();
const key = (workspaceId: string, userId: string) =>
	`${workspaceId}::${userId}`;

/** Listen to `userId`'s unread count in `workspaceId`; returns the detach. */
export const subscribeInbox = (
	workspaceId: string,
	userId: string,
	send: (e: InboxEvent) => void,
) => listeners.subscribe(key(workspaceId, userId), send);

/** Tell `userId`'s open inboxes in `workspaceId` their unread count. */
export const publishUnread = (
	workspaceId: string,
	userId: string,
	count: number,
) =>
	listeners.publish(key(workspaceId, userId), { type: "inbox.unread", count });

export function makeInboxStreamHandler(wdb: WorkspaceDbService) {
	return sseChannel<{ workspaceId: string; userId: string; count: number }>({
		name: "inbox",
		authorize: Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const workspaceId = new URL(req.url, "http://localhost").searchParams.get(
				"workspaceId",
			);
			if (!workspaceId) return yield* refuse(400, "Missing workspaceId");
			// EventSource cannot send headers, so the workspace arrives as a query
			// param and is proven here rather than through withAuthedWorkspace.
			const ctx = yield* Effect.result(
				resolveWorkspaceContext(workspaceId).pipe(
					Effect.provide(PlatformDbLive),
				),
			);
			if (ctx._tag === "Failure")
				return yield* refuse(ctx.failure.status, ctx.failure.message);
			const count = yield* unreadCount(ctx.success.userId).pipe(
				Effect.provide(Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive)),
				Effect.orElseSucceed(() => 0),
			);
			return { workspaceId, userId: ctx.success.userId, count };
		}),
		initial: ({ count }) => ({ type: "inbox.unread", count }),
		subscribe: ({ workspaceId, userId }, send) =>
			subscribeInbox(workspaceId, userId, send),
	});
}
