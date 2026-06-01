import { RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { AppRpc } from "./api.js";

// ── Derive typed client interface from AppRpc schema ──────────────────────

type AppRpcRpcs = RpcGroup.Rpcs<typeof AppRpc>;

/** Extract a single RPC definition by method tag. */
type ByTag<K extends AppRpcRpcs["_tag"]> = Extract<AppRpcRpcs, { _tag: K }>;

/**
 * Fully typed API client interface derived from AppRpc.
 * Each method name maps to a function that takes the typed payload and
 * returns a Promise of the typed response.
 *
 * Methods defined without a payload (void schema) accept no arguments.
 */
export type TypedApiClient = {
  [K in AppRpcRpcs["_tag"]]: ByTag<K> extends infer RPC
    ? RPC extends { payloadSchema: Schema.Schema<infer P>; successSchema: Schema.Schema<infer S> }
      ? [P] extends [void]
        ? () => Promise<S>
        : (payload: P) => Promise<S>
      : never
    : never;
};

/**
 * Create a fully typed API client that delegates to a fetch-based transport.
 *
 * The returned object is typed via `TypedApiClient` so callers get
 * compile-time errors on misspelled methods or wrong payloads.
 */
export function createTypedApiClient(
  fetchApi: (method: string, payload: Record<string, unknown>) => Promise<any>,
): TypedApiClient {
  const methodStubs: Record<string, (payload: any) => Promise<any>> = {};

  for (const tag of AppRpc.requests.keys()) {
    const rpc = AppRpc.requests.get(tag)!;
    const isVoidPayload = rpc.payloadSchema.ast === Schema.Void.ast;

    methodStubs[tag] = isVoidPayload
      ? () => fetchApi(tag, {})
      : (payload: unknown) => fetchApi(tag, payload as Record<string, unknown>);
  }

  return methodStubs as unknown as TypedApiClient;
}
