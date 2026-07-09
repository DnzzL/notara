/**
 * Typed RPC client for the Effect RPC HTTP server.
 *
 * Method names, payloads, and return types are derived from the shared AppRpc
 * schema — if the schema changes, the client type fails to compile.
 *
 * Transport is fetch-based (works in browsers without Effect platform HttpClient).
 * Response types are validated through Effect's serialization protocol.
 */
import { createTypedApiClient, type TypedApiClient } from "@notara/shared";

export type AclRelation = "owner" | "editor" | "viewer";

/** Thrown when the server returns a 403 (permission denied). */
export class AccessDeniedError extends Error {
  readonly _tag = "AccessDeniedError";
  constructor(message: string = "You don't have access to this resource") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Heuristic: pick a 403 out of a serialized Effect failure cause or defect. */
function looksLike403(cause: unknown): boolean {
  const s = typeof cause === "string" ? cause : JSON.stringify(cause);
  return (
    s.includes('"status":403') ||
    s.includes("Insufficient permission") ||
    s.includes("Not a member of this workspace") ||
    s.includes("Workspace owner role required")
  );
}

/** Extract a human-readable message from a Defect payload. */
function defectMessage(defect: unknown): string {
  if (typeof defect === "string") return defect;
  if (defect && typeof defect === "object") {
    const d = defect as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    return JSON.stringify(defect);
  }
  return "Unknown server error";
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

  // Try to find an Exit response matching our request ID (success or typed failure)
  const exitResult = (results as Array<{ requestId: string; _tag: string; exit: { _tag: string; value?: T; cause?: unknown } }>).find(
    (r) => r.requestId === id && r._tag === "Exit",
  );

  if (exitResult) {
    if (exitResult.exit._tag === "Failure") {
      if (looksLike403(exitResult.exit.cause)) {
        throw new AccessDeniedError();
      }
      throw new Error(`RPC ${method} error: ${JSON.stringify(exitResult.exit.cause)}`);
    }
    return exitResult.exit.value as T;
  }

  // If no Exit matched, check for a Defect (handler used Effect.orDie, which
  // converts failures to defects — the RPC framework sends these without a
  // matching requestId). Extract the error from the defect payload.
  const defectResult = (results as Array<{ _tag: string; defect?: unknown }>).find(
    (r) => r._tag === "Defect",
  );
  if (defectResult && defectResult.defect !== undefined) {
    const defect = defectResult.defect;
    if (looksLike403(defect)) {
      throw new AccessDeniedError();
    }
    throw new Error(defectMessage(defect));
  }

  throw new Error(`RPC ${method}: no response for id ${id}`);
}

/**
 * Fully typed API client. Method signatures are inferred from AppRpc so
 * adding a new endpoint to the schema automatically updates this client's type.
 */
export const api: TypedApiClient = createTypedApiClient(rpcCall);
