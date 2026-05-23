import { Effect, Stream } from "effect";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { auth } from "../auth.js";
import { presence, type PresenceEvent } from "./index.js";
import * as Permissions from "../handlers/permissions.js";
import { PlatformDb } from "../platform-db.js";
import { WorkspaceDb } from "../db.js";

const corsBase = {
  "Access-Control-Allow-Origin": process.env.BASE_URL ?? "*",
  "Vary": "Origin",
};

function jsonResponse(body: unknown, status = 200) {
  return HttpServerResponse.text(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsBase },
  });
}

/** POST /api/presence/heartbeat — body: { workspaceId, pageId, focusedBlockId } */
export const heartbeatHandler = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest;
  const headers = new Headers(req.headers as Record<string, string>);
  const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
  if (!session) return jsonResponse({ error: "Unauthorized" }, 401);

  const ab = yield* req.arrayBuffer;
  let body: { workspaceId?: string; pageId?: string; focusedBlockId?: string | null };
  try {
    body = JSON.parse(Buffer.from(ab).toString("utf-8"));
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const { workspaceId, pageId } = body;
  if (!workspaceId || !pageId) return jsonResponse({ error: "Missing workspaceId or pageId" }, 400);

  const wdb = yield* WorkspaceDb;
  const permCheck = yield* Effect.either(
    Permissions.checkPagePermission(session.user.id, workspaceId, pageId, "viewer").pipe(
      Effect.provide(wdb.getLayer(workspaceId)),
    ),
  );
  if (permCheck._tag === "Left") return jsonResponse({ error: "Forbidden" }, 403);

  presence.heartbeat({
    workspaceId,
    pageId,
    user: { id: session.user.id, name: session.user.name ?? session.user.email ?? "Anonymous" },
    focusedBlockId: body.focusedBlockId ?? null,
  });

  return jsonResponse({
    presence: presence.presence(workspaceId, pageId).filter((p) => p.userId !== session.user.id),
  });
}).pipe(
  Effect.catchAllCause(() => Effect.succeed(jsonResponse({ error: "Server error" }, 500))),
);

/** GET /api/presence/stream?workspaceId=…&pageId=… — SSE */
export const streamHandler = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest;
  const headers = new Headers(req.headers as Record<string, string>);
  const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
  if (!session) return jsonResponse({ error: "Unauthorized" }, 401);

  const url = new URL(req.url, "http://localhost");
  const workspaceId = url.searchParams.get("workspaceId");
  const pageId = url.searchParams.get("pageId");
  if (!workspaceId || !pageId) return jsonResponse({ error: "Missing query params" }, 400);

  const wdb = yield* WorkspaceDb;
  const permCheck = yield* Effect.either(
    Permissions.checkPagePermission(session.user.id, workspaceId, pageId, "viewer").pipe(
      Effect.provide(wdb.getLayer(workspaceId)),
    ),
  );
  if (permCheck._tag === "Left") return jsonResponse({ error: "Forbidden" }, 403);

  const userId = session.user.id;
  const encoder = new TextEncoder();
  const encodeEvent = (e: PresenceEvent) =>
    encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);

  const sseStream = Stream.async<Uint8Array>((emit) => {
    // Initial event: current page presence so the new subscriber starts populated.
    emit.single(encodeEvent({
      type: "presence.changed",
      users: presence.presence(workspaceId, pageId),
    }));

    const unsubscribe = presence.subscribe(workspaceId, pageId, userId, (event) => {
      emit.single(encodeEvent(event));
    });

    // Heartbeat comment frames every 20s keep the connection alive through proxies.
    const keepAlive = setInterval(() => emit.single(encoder.encode(`: ping\n\n`)), 20_000);

    return Effect.sync(() => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  return HttpServerResponse.stream(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsBase,
    },
  });
}).pipe(
  Effect.catchAllCause(() => Effect.succeed(jsonResponse({ error: "Server error" }, 500))),
);
