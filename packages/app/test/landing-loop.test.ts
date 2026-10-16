/**
 * The landing page proves the loop with a real transcript (NOT-174). This
 * guards the one drift worth guarding cheaply: every call that transcript shows
 * must be one `/llms.txt` documents, or the landing teaches an agent a loop the
 * product does not have. See `src/lib/landing-loop.ts`.
 */
import { describe, expect, test } from "bun:test";
import { loopSteps } from "../src/lib/landing-loop.js";

const calls = loopSteps.flatMap((step) => step.calls);

describe("landing loop transcript", () => {
	test("walks a card's cycle in three beats", () => {
		expect(loopSteps).toHaveLength(3);
	});

	test("quotes only calls /llms.txt documents", async () => {
		const source = await Bun.file(
			new URL("../../server/src/api-v1/llms.ts", import.meta.url),
		).text();
		for (const { method, path } of calls)
			expect(source).toContain(`${method} ${path}`);
	});
});
