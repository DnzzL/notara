/**
 * A read key cannot write.
 *
 * Enforcement is one chokepoint — the v1 router refuses any non-GET carried by
 * a read key — rather than a check per operation. Twenty-eight places to
 * remember a guard is the exact shape of NOT-102, where a handler simply never
 * wrote the one its neighbours had.
 *
 * That chokepoint is only safe while a GET never mutates. That invariant is not
 * self-evident and nobody would think to preserve it deliberately, so it is
 * asserted here rather than assumed.
 */
import { describe, expect, test } from "bun:test";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import { type Context, Effect, Layer } from "effect";
import { registerV1Routes } from "../src/api-v1/routes.js";
import { mutates } from "../src/api-v1/scope.js";

/** Every route the v1 surface registers, collected from the real registration. */
const registeredRoutes = (): Array<{ method: string; path: string }> => {
	const seen: Array<{ method: string; path: string }> = [];
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
					HttpLayerRouter.HttpRouter,
					recorder as unknown as Context.Tag.Service<
						typeof HttpLayerRouter.HttpRouter
					>,
				),
			),
		) as Effect.Effect<void, never, never>,
	);
	return seen;
};

describe("mutates", () => {
	test("every write method counts as a mutation", () => {
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			expect(mutates(method), method).toBe(true);
		}
	});

	test("GET and HEAD do not", () => {
		expect(mutates("GET")).toBe(false);
		expect(mutates("HEAD")).toBe(false);
	});

	test("an unrecognised method counts as a mutation", () => {
		// Failing closed matters more here than being right: a method nobody
		// anticipated must not be the way a read key gets to write.
		expect(mutates("PROPPATCH")).toBe(true);
		expect(mutates("")).toBe(true);
	});
});

describe("the invariant the chokepoint rests on", () => {
	test("no GET route is named like something that changes state", () => {
		// Enforcing by method is only sound while a GET never mutates. Nothing
		// makes that true on its own, so this is the guard: a GET route whose
		// name suggests a write is either misnamed or has broken the invariant,
		// and either way someone should look.
		const suspicious = registeredRoutes()
			.filter((r) => r.method === "GET")
			.filter((r) =>
				/\/(create|update|delete|restore|import|trigger|reset|revoke)(\/|$)/.test(
					r.path,
				),
			)
			.map((r) => `${r.method} ${r.path}`);

		expect(
			suspicious,
			`these GET routes look like they mutate, which would let a read key write:\n  ${suspicious.join("\n  ")}`,
		).toEqual([]);
	});

	test("the route list is non-empty, so the check above cannot pass vacuously", () => {
		expect(registeredRoutes().length).toBeGreaterThan(0);
	});
});
