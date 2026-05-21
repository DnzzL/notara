import { Effect, Data } from "effect";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import { PlatformDb } from "../platform-db.js";
import { auth } from "../auth.js";
import { createHash, randomBytes } from "node:crypto";

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly status: number;
  readonly message: string;
}> {}

// ── Key generation helpers ────────────────────────────────────────────────────

export const sha256 = (s: string) =>
  createHash("sha256").update(s).digest("hex");

/** Generate a fresh API key: `ntr_<32 random hex chars>`. */
export const generateApiKey = (): { raw: string; hash: string; prefix: string } => {
  const raw = `ntr_${randomBytes(16).toString("hex")}`;
  return { raw, hash: sha256(raw), prefix: raw.slice(0, 10) };
};

// ── Authenticated user ────────────────────────────────────────────────────────

export type ApiUser = { userId: string; keyId: string | null };

/**
 * Resolves the calling user from either:
 *   1. `Authorization: Bearer ntr_...`  — API key
 *   2. Session cookie set by Better Auth
 *
 * Fails with `ApiError(401)` if neither is valid.
 */
export const resolveApiUser: Effect.Effect<
  ApiUser,
  ApiError,
  PlatformDb | HttpServerRequest.HttpServerRequest
> = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest;
  const authHeader = req.headers["authorization"] as string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const keyHash = sha256(token);

    const db = yield* PlatformDb;
    const key = db
      .prepare("SELECT id, user_id FROM api_keys WHERE key_hash = ?")
      .get(keyHash) as { id: string; user_id: string } | null;

    if (!key) {
      return yield* Effect.fail(new ApiError({ status: 401, message: "Invalid API key" }));
    }

    db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      key.id,
    );

    return { userId: key.user_id, keyId: key.id };
  }

  const headers = new Headers(req.headers as Record<string, string>);
  const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
  if (!session) {
    return yield* Effect.fail(
      new ApiError({
        status: 401,
        message: "Unauthorized — provide a session cookie or Authorization: Bearer <api-key>",
      }),
    );
  }

  return { userId: session.user.id, keyId: null };
});

// ── Workspace membership check ────────────────────────────────────────────────

/**
 * Verifies the user is a member of the workspace and returns their role.
 * Fails with `ApiError(403)` if not.
 */
export const requireWorkspaceMember = (workspaceId: string, userId: string) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;
    const member = db
      .prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      )
      .get(workspaceId, userId) as { role: "owner" | "member" } | null;

    if (!member) {
      return yield* Effect.fail(
        new ApiError({ status: 403, message: "Not a member of this workspace" }),
      );
    }
    return member.role;
  });
