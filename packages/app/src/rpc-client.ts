/**
 * Typed RPC client for the Effect RPC HTTP server.
 *
 * Method names, payloads, and return types are derived from the shared AppRpc
 * schema — if the schema changes, the client type fails to compile.
 *
 * Transport is fetch-based (works in browsers without Effect platform HttpClient).
 * Response types are validated through Effect's serialization protocol.
 */
import { createTypedApiClient, type TypedApiClient } from "@notion-alt/shared";

export type AclRelation = "owner" | "editor" | "viewer";

/** Thrown when the server returns a 403 (permission denied). */
export class AccessDeniedError extends Error {
  readonly _tag = "AccessDeniedError";
  constructor(message: string = "You don't have access to this resource") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Heuristic: pick a 403 out of a serialized Effect failure cause. */
function looksLike403(cause: unknown): boolean {
  const s = typeof cause === "string" ? cause : JSON.stringify(cause);
  return (
    s.includes('"status":403') ||
    s.includes("Insufficient permission") ||
    s.includes("Not a member of this workspace") ||
    s.includes("Workspace owner role required")
  );
}

const API_URL = "/api";
let nextId = 1;

let currentWorkspaceId: string | null = null;

export function setCurrentWorkspaceId(id: string | null) {
  currentWorkspaceId = id;
}

export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId;
}

async function rpcCall<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const id = String(nextId++);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (currentWorkspaceId) {
    headers["X-Workspace-Id"] = currentWorkspaceId;
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      _tag: "Request",
      id,
      tag: method,
      payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed: ${response.status} ${response.statusText}`);
  }

  const results = await response.json();
  const result = (results as Array<{ requestId: string; _tag: string; exit: { _tag: string; value?: T; cause?: unknown } }>).find(
    (r) => r.requestId === id,
  );
  if (!result) throw new Error(`RPC ${method}: no response for id ${id}`);

  if (result._tag === "Exit" && result.exit._tag === "Failure") {
    if (looksLike403(result.exit.cause)) {
      throw new AccessDeniedError();
    }
    throw new Error(`RPC ${method} error: ${JSON.stringify(result.exit.cause)}`);
  }

  return result.exit.value as T;
}

/**
 * Fully typed API client. Method signatures are inferred from AppRpc so
 * adding a new endpoint to the schema automatically updates this client's type.
 */
export const api: TypedApiClient = createTypedApiClient(rpcCall);
