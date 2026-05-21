import { Context, Effect } from "effect";
import { HttpServerRequest } from "@effect/platform";
import { auth } from "./auth.js";
import { PlatformDb } from "./platform-db.js";

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
