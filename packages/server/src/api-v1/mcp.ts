/**
 * The MCP door at /mcp (NOT-169.2): one tool per typed operation, served over
 * Streamable HTTP by the MCP server that ships with Effect.
 *
 * Tools are derived from `typedOperations`, so an operation that moves to the
 * typed table appears here with no change to this file. A tool's name is the
 * operation id, its input the operation's input plus `workspaceId` (unless the
 * operation names no workspace, like listWorkspaces), its result
 * the operation's encoded output — the same JSON the REST door answers with.
 *
 * Auth is the API key and nothing else (no cookie session): the route
 * middleware resolves it with `resolveApiKey` and provides the caller to every
 * request. Running a tool goes through `runOperation`, the path REST takes, so
 * membership and page permissions are checked exactly as there.
 *
 * Scope: a read key does not see write tools, and calling one by name is
 * MCP's "tool not found". The only per-request hook Effect 4.0.0 offers is the
 * `EnabledWhen` annotation, which is given no request; it reads the caller off
 * the current fiber instead. That leans on how RpcServer runs handlers, not on
 * a documented contract — the read-key tests in mcp.test.ts pin it.
 */

import { ApiError, AuthError } from "@notara/shared";
import { Context, Effect, Fiber, Layer, Option, Schema } from "effect";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import { failureResponse } from "../http-error.js";
import { PlatformDbLive } from "../platform-db.js";
import { type ApiKey, resolveApiKey } from "./auth.js";
import { runOperation, typedOperations } from "./operations.js";
import { allows } from "./scope.js";

/** The API key behind the current /mcp request. */
class McpCaller extends Context.Service<McpCaller, ApiKey>()(
	"notara/McpCaller",
) {}

/** The caller's scope, read off the running fiber (see the module note). */
const callerScope = () => {
	const fiber = Fiber.getCurrent();
	return fiber && Context.getOrUndefined(fiber.context, McpCaller)?.scope;
};

const workspaceIdField = {
	workspaceId: Schema.String.annotate({ description: "Workspace ID" }),
};

const tools = typedOperations.map((op) => {
	const fields =
		"workspace" in op
			? op.input.fields
			: { ...workspaceIdField, ...op.input.fields };
	return Tool.make(op.operationId, {
		description: op.description ?? op.summary,
		// MCP wants an object schema; an empty Struct does not encode to one.
		parameters:
			Object.keys(fields).length > 0 ? Schema.Struct(fields) : Tool.EmptyParams,
		success: op.output,
		failure: ApiError,
	})
		.annotate(Tool.Readonly, op.scope === "read")
		.annotate(Tool.Destructive, op.scope === "write")
		.annotate(McpSchema.EnabledWhen, () => {
			const scope = callerScope();
			return scope !== undefined && allows(scope, op.scope);
		});
});

const NotaraTools = Toolkit.make(...tools);

const handlers = NotaraTools.toLayer(
	Object.fromEntries(
		typedOperations.map((op) => [
			op.operationId,
			({ workspaceId, ...input }: { workspaceId?: string }) =>
				Effect.gen(function* () {
					const caller = yield* Effect.serviceOption(McpCaller);
					if (Option.isNone(caller))
						return yield* Effect.fail(
							new AuthError({ status: 401, message: "Invalid API key" }),
						);
					return yield* runOperation(
						op,
						caller.value.userId,
						Effect.succeed(workspaceId as string),
						Effect.succeed(input),
					);
				}),
		]),
	) as never,
);

/** Resolves the Bearer key and provides it to the request; refuses anything else. */
const McpAuth = HttpRouter.middleware((httpEffect) =>
	Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const caller = yield* resolveApiKey(req).pipe(
			Effect.provide(PlatformDbLive),
			Effect.result,
		);
		if (caller._tag === "Failure") return failureResponse(caller.failure);
		return yield* Effect.provideService(httpEffect, McpCaller, caller.success);
	}),
).layer;

export const McpLive = Layer.mergeAll(
	McpServer.layerHttp({
		name: "notara",
		version: process.env.APP_VERSION?.trim() || "dev",
		path: "/mcp",
		protocols: [
			McpProtocol.v2026_07_28,
			McpProtocol.v2025_11_25,
			McpProtocol.v2025_06_18,
		],
	}).pipe(Layer.provide(McpAuth)),
	McpServer.toolkit(NotaraTools).pipe(Layer.provide(handlers)),
);
