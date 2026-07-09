import { Context, Effect } from "effect";
import { HttpServerRequest } from "@effect/platform";
import { auth } from "./auth.js";
import { PlatformDb } from "./platform-db.js";
import { WorkspaceDb } from "./db.js";

export class WorkspaceContext extends Context.Tag("WorkspaceContext")<
  WorkspaceContext,
  { userId: string; workspaceId: string; role: "owner" | "member" }
>() {}

export class AuthError {
  readonly _tag = "AuthError";
  constructor(readonly status: 401 | 403, readonly message: string) {}
}

export const resolveWorkspaceContext = (workspaceId: string) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const db = yield* PlatformDb;

    const headers = new Headers();
    for (const [k, v] of Object.entries(request.headers)) {
      if (typeof v === "string") headers.set(k, v);
    }

    const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
    if (!session) {
      return yield* Effect.fail(new AuthError(401, "Unauthorized"));
    }

    const userId = session.user.id;

    const memberRow = db
      .prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      )
      .get(workspaceId, userId) as { role: string } | null;

    if (!memberRow) {
      return yield* Effect.fail(new AuthError(403, "Forbidden"));
    }

    return { userId, workspaceId, role: memberRow.role as "owner" | "member" };
  });

export const getSessionUser = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (typeof v === "string") headers.set(k, v);
  }
  const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
  if (!session) {
    return yield* Effect.fail(new AuthError(401, "Unauthorized"));
  }
  return session.user;
});

/** Resolve workspace DB from X-Workspace-Id header and provide the SqlClient layer. */
export const withWorkspaceDb = <A, E, R>(inner: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const workspaceId = request.headers["x-workspace-id"] as string | undefined;
    if (!workspaceId) return yield* Effect.die(new Error("Missing X-Workspace-Id header"));

    const wdb = yield* WorkspaceDb;
    const dbLayer = wdb.getLayer(workspaceId);
    return yield* inner.pipe(Effect.provide(dbLayer));
  });

/**
 * Authenticated user + workspace context. Yields { userId, workspaceId, role }
 * to the inner builder, runs it with the per-workspace SqlClient layer applied.
 */
export const withAuthedWorkspace = <A, E, R>(
  build: (ctx: {
    userId: string;
    workspaceId: string;
    role: "owner" | "member";
  }) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const user = yield* getSessionUser;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const workspaceId = request.headers["x-workspace-id"] as string | undefined;
    if (!workspaceId) return yield* Effect.die(new Error("Missing X-Workspace-Id header"));
    const db = yield* PlatformDb;
    const memberRow = db
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, user.id) as { role: "owner" | "member" } | null;
    if (!memberRow) {
      return yield* Effect.fail(new AuthError(403, "Not a workspace member"));
    }
    const wdb = yield* WorkspaceDb;
    return yield* build({ userId: user.id, workspaceId, role: memberRow.role }).pipe(
      Effect.provide(wdb.getLayer(workspaceId)),
    );
  });
