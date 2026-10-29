/**
 * The OpenAPI document and the routes it describes must agree.
 *
 * The document's paths are generated from the operation table in
 * `api-v1/operations.ts`, the same table the REST router registers from
 * (NOT-169). This file asserts that they still agree, so a route registered
 * outside the table, or a table entry the document leaves out, cannot pass.
 *
 * A published REST API whose document silently drifts is worse than one with no
 * document: consumers build against paths that do not exist, or never learn
 * about paths that do. `packages/cli` is exactly such a consumer.
 *
 * This is also the first test to import `registerV1Routes` at all — that whole
 * surface previously had none.
 *
 * The route table is collected by running the real registration effect against
 * a router that records instead of serving, so the test reads the same source of
 * truth the server does rather than a copy of it.
 */
import { describe, expect, test } from "bun:test";
import { type Context, Effect, Layer } from "effect";
import * as HttpRouter from "effect/http/HttpRouter";
import { spec } from "../src/api-v1/openapi.js";
import { typedOperations } from "../src/api-v1/operations.js";
import { registerV1Routes } from "../src/api-v1/routes.js";

type Endpoint = { method: string; path: string };

/**
 * Meta-routes: the document and the viewer that serves it. They are part of the
 * deployment, not part of the described API, so the spec rightly omits them.
 */
const NOT_DOCUMENTED = new Set(["GET /api/v1/openapi.json", "GET /api/docs"]);

const HTTP_METHODS = new Set([
	"get",
	"put",
	"post",
	"delete",
	"patch",
	"options",
	"head",
]);

const show = ({ method, path }: Endpoint) => `${method} ${path}`;

/** OpenAPI writes `{id}`; the router writes `:id`. Same path, two spellings. */
const toRouterPath = (specPath: string) =>
	specPath.replace(/\{([^}]+)\}/g, ":$1");

/** Run the real registration against a router that only remembers. */
const registeredEndpoints = (): Endpoint[] => {
	const seen: Endpoint[] = [];
	const recorder = {
		add: (method: string, path: string) =>
			Effect.sync(() => {
				seen.push({ method, path });
			}),
		addAll: () => Effect.void,
		addGlobalMiddleware: () => Effect.void,
	};

	Effect.runSync(
		registerV1Routes.pipe(
			Effect.provide(
				Layer.succeed(
					HttpRouter.HttpRouter,
					recorder as unknown as Context.Service.Shape<
						typeof HttpRouter.HttpRouter
					>,
				),
			),
		) as Effect.Effect<void, never, never>,
	);

	return seen.filter((e) => !NOT_DOCUMENTED.has(show(e)));
};

/** Endpoints the document declares, as absolute paths in router spelling. */
const documentedEndpoints = (): Endpoint[] => {
	const base = spec.servers?.[0]?.url ?? "";
	const out: Endpoint[] = [];

	for (const [specPath, item] of Object.entries(spec.paths)) {
		for (const [key, operation] of Object.entries(
			item as Record<string, unknown>,
		)) {
			if (!HTTP_METHODS.has(key) || !operation) continue;
			out.push({
				method: key.toUpperCase(),
				path: `${base}${toRouterPath(specPath)}`,
			});
		}
	}
	return out;
};

describe("the OpenAPI document describes the routes that exist", () => {
	const registered = registeredEndpoints().map(show).sort();
	const documented = documentedEndpoints().map(show).sort();

	test("the document declares at least one path, so an empty spec cannot pass", () => {
		// Without this, a spec that failed to load would make both differences
		// below trivially empty and the whole file vacuously green.
		expect(documented.length).toBeGreaterThan(0);
		expect(registered.length).toBeGreaterThan(0);
	});

	test("every registered route is documented", () => {
		const undocumented = registered.filter((e) => !documented.includes(e));
		expect(
			undocumented,
			`registered but absent from the OpenAPI document:\n  ${undocumented.join("\n  ")}`,
		).toEqual([]);
	});

	test("page operations are documented from the Schemas they decode with", () => {
		// The RPC bound on a title (500 chars) and the Page fields that are always
		// present (deletedAt included) appear only when the document is generated
		// from the operation's Schemas: the hand-written entries said neither.
		// Walked as plain JSON, the way a client reads the served document.
		const doc = JSON.parse(JSON.stringify(spec));
		const pages = doc.paths["/workspaces/{workspaceId}/pages"];
		const body =
			pages.post.requestBody.content["application/json"].schema.properties;
		expect(body.title.maxLength).toBe(500);
		expect(doc.components.schemas.Page?.required).toContain("deletedAt");

		const pageOps = Object.values(spec.paths)
			.flatMap((item) => Object.values(item as Record<string, unknown>))
			.map((op) => (op as { operationId?: string }).operationId)
			.filter((id) => id?.endsWith("Page") || id === "listPages")
			.sort();
		expect(pageOps).toEqual([
			"createPage",
			"deletePage",
			"getPage",
			"listPages",
			"restorePage",
			"updatePage",
		]);
	});

	test("block, search and trash operations are documented from their Schemas", () => {
		// Bounds and fields that only the shared RPC Schemas carry: the content
		// cap, the query cap, and a trashed page's always-present deletedAt.
		const doc = JSON.parse(JSON.stringify(spec));
		const blocks = doc.paths["/workspaces/{workspaceId}/pages/{pageId}/blocks"];
		const body =
			blocks.post.requestBody.content["application/json"].schema.properties;
		expect(body.content.maxLength).toBe(1_048_576);
		const search = doc.paths["/workspaces/{workspaceId}/search"].get;
		const q = search.parameters.find((p: { name: string }) => p.name === "q");
		expect(q).toMatchObject({ in: "query", required: true });
		expect(q.schema.maxLength).toBe(500);
		const trashedPageRef: string =
			doc.components.schemas.TrashContents.properties.pages.items.$ref;
		const trashedPage =
			doc.components.schemas[trashedPageRef.split("/").pop()!];
		expect(trashedPage.required).toContain("deletedAt");
	});

	test("every documented path is actually served", () => {
		const missing = documented.filter((e) => !registered.includes(e));
		expect(
			missing,
			`documented but not registered — consumers would get a 404:\n  ${missing.join("\n  ")}`,
		).toEqual([]);
	});
});

describe("the OpenAPI document is the operation table", () => {
	test("each documented operation is a table entry, with its method, path, tag and summary", () => {
		const documented = Object.entries(spec.paths)
			.flatMap(([specPath, item]) =>
				Object.entries(item as Record<string, unknown>)
					.filter(([key]) => HTTP_METHODS.has(key))
					.map(([key, op]) => {
						const o = op as {
							operationId: string;
							tags: string[];
							summary: string;
						};
						return {
							operationId: o.operationId,
							method: key.toUpperCase(),
							path: `/api/v1${toRouterPath(specPath)}`,
							tag: o.tags[0],
							summary: o.summary,
						};
					}),
			)
			.sort((a, b) => a.operationId.localeCompare(b.operationId));
		const table = typedOperations
			.map(({ operationId, method, path, tag, summary }) => ({
				operationId,
				method,
				path,
				tag,
				summary,
			}))
			.sort((a, b) => a.operationId.localeCompare(b.operationId));
		expect(table.length).toBeGreaterThan(0);
		expect(documented).toEqual(table);
	});
});

describe("the OpenAPI document tells the truth about answers and terms", () => {
	const operations = Object.values(spec.paths).flatMap((item) =>
		Object.entries(item as Record<string, unknown>)
			.filter(([key]) => HTTP_METHODS.has(key))
			.map(([, op]) => op as { responses: Record<string, unknown> }),
	);

	test("every operation documents a conflict and a malformed body", () => {
		expect(operations.length).toBeGreaterThan(0);
		for (const op of operations)
			expect(Object.keys(op.responses)).toEqual(
				expect.arrayContaining(["400", "409"]),
			);
	});

	test("the licence is the one the code ships under", () => {
		expect(spec.info.license.name).toBe("AGPL-3.0-or-later");
	});

	test("scope is described per operation, not per HTTP method", () => {
		expect(spec.info.description).not.toContain("only issue GET");
	});
});
