/**
 * Change events: what an agent subscribes to instead of polling (NOT-183, ADR-015).
 *
 * Which operations emit, and how to read the id they touched, is declared once
 * on the operation table (`change` in api-v1/operations.ts). `trackChange`
 * is the single place that turns a finished operation into an event: REST and
 * MCP reach it through `runOperation`, the UI's RPC door through the wrapper in
 * rpc-handlers.ts, which reads the same table. No handler emits anything.
 *
 * Delivery is filtered per subscriber at publish time, with the same page-ACL
 * check (and key subtree) every read goes through: no event for content the
 * subscriber cannot read. The SSE mechanics live in `sse-channel.ts`.
 */

import type { Context } from "effect";
import { Effect, Layer } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import { KeyRoot } from "./acl.js";
import { requireWorkspaceMember, resolveApiUser } from "./api-v1/auth.js";
import type { WorkspaceDb } from "./db.js";
import * as Blocks from "./handlers/blocks.js";
import * as Permissions from "./handlers/permissions.js";
import { PlatformDbLive } from "./platform-db.js";
import { refuse, sseChannel } from "./sse-channel.js";

type WorkspaceDbService = Context.Service.Shape<typeof WorkspaceDb>;

export type ChangeKind = "page" | "block" | "record";
export type ChangeOp = "create" | "update" | "delete";

/**
 * Declared on an operation. `id` names the input field holding the changed id,
 * or `"output"` when the operation returns the thing it created. The RPC door
 * calls that input field `id`, so it is the fallback.
 */
export type ChangeSpec = {
	readonly kind: ChangeKind;
	readonly op: ChangeOp;
	readonly id: "output" | (string & {});
};

export type ChangeEvent = {
	type: "change";
	workspaceId: string;
	kind: ChangeKind;
	op: ChangeOp;
	id: string;
	/** The page that owns it (itself for a page): what permissions are decided on. */
	pageId: string;
	/** User id of the editor: the person, or the key's owner for an API edit. */
	updatedBy: string;
};

type Subscriber = (event: ChangeEvent) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export const publishChange = (event: ChangeEvent) => {
	for (const push of subscribers.get(event.workspaceId) ?? []) push(event);
};

type Io = Record<string, any> | undefined;
const idOf = (spec: ChangeSpec, input: Io, output: Io): string | undefined =>
	spec.id === "output" ? output?.id : (input?.[spec.id] ?? input?.id);

const ownerPage = (kind: ChangeKind, id: string) =>
	kind === "page"
		? Effect.succeed<string | null>(id)
		: kind === "block"
			? Blocks.getBlockPageId(id)
			: Permissions.getRecordPageId(id);

/**
 * Run `run`, then publish what it changed. A failed operation emits nothing.
 * The owning page is read before a delete (the row may be gone after) and after
 * a create (the id only exists then).
 */
export const trackChange = <A, E, R>(
	spec: ChangeSpec,
	ctx: { workspaceId: string; userId: string },
	input: unknown,
	run: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const inId = idOf(spec, input as Io, undefined);
		const before = inId ? yield* ownerPage(spec.kind, inId) : null;
		const output = yield* run;
		const id = idOf(spec, input as Io, output as Io);
		if (!id) return output;
		const pageId = before ?? (yield* ownerPage(spec.kind, id));
		if (pageId)
			publishChange({
				type: "change",
				workspaceId: ctx.workspaceId,
				kind: spec.kind,
				op: spec.op,
				id,
				pageId,
				updatedBy: ctx.userId,
			});
		return output;
	});

/**
 * `GET /api/v1/workspaces/:workspaceId/events` — an API key (Bearer) or the
 * session cookie. A read-scoped key may listen; a subtree key hears only its subtree.
 */
export const makeChangeStreamHandler = (wdb: WorkspaceDbService) =>
	sseChannel<{
		workspaceId: string;
		userId: string;
		rootPageId: string | null;
	}>({
		name: "change-events",
		authorize: Effect.gen(function* () {
			const req = yield* HttpServerRequest.HttpServerRequest;
			const workspaceId = new URL(req.url, "http://localhost").pathname.match(
				/\/workspaces\/([^/]+)\/events$/,
			)?.[1];
			if (!workspaceId) return yield* refuse(400, "Missing workspaceId");

			const caller = yield* Effect.result(
				resolveApiUser.pipe(Effect.provide(PlatformDbLive)),
			);
			if (caller._tag === "Failure") {
				return yield* refuse(caller.failure.status, caller.failure.message);
			}
			const member = yield* Effect.result(
				requireWorkspaceMember(workspaceId, caller.success.userId).pipe(
					Effect.provide(PlatformDbLive),
				),
			);
			if (member._tag === "Failure") return yield* refuse(403, "Forbidden");

			return {
				workspaceId,
				userId: caller.success.userId,
				rootPageId: caller.success.rootPageId ?? null,
			};
		}),
		// Flushes the headers, and tells the client it is subscribed: an edit made
		// after this frame cannot be missed.
		initial: () => ({ type: "ready" }),
		subscribe: ({ workspaceId, userId, rootPageId }, send) => {
			// One chain per subscriber keeps events in the order they were published
			// even though each waits on an async permission check.
			let tail = Promise.resolve();
			const push: Subscriber = (event) => {
				tail = tail
					.then(async () => {
						const visible = await Permissions.canAccessPage(
							userId,
							workspaceId,
							event.pageId,
							"viewer",
						).pipe(
							Effect.provide(
								Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive),
							),
							Effect.provideService(KeyRoot, rootPageId),
							Effect.runPromise,
						);
						if (visible) send(event);
					})
					.catch(() => {});
			};
			const set = subscribers.get(workspaceId) ?? new Set<Subscriber>();
			subscribers.set(workspaceId, set);
			set.add(push);
			return () => {
				set.delete(push);
				if (set.size === 0) subscribers.delete(workspaceId);
			};
		},
	});
