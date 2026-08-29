/**
 * The OpenAPI document and the routes it describes must agree.
 *
 * `api-v1/openapi.ts` says so in its own opening line: it is a hand-written
 * object, derived from nothing. Until this file, the eighteen paths it declares
 * matched the routes actually registered by discipline alone, and nothing
 * asserted it.
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
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { spec } from "../src/api-v1/openapi.js";
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

	test("every documented path is actually served", () => {
		const missing = documented.filter((e) => !registered.includes(e));
		expect(
			missing,
			`documented but not registered — consumers would get a 404:\n  ${missing.join("\n  ")}`,
		).toEqual([]);
	});
});
