/**
 * `/llms.txt` is generated from the operation table: served without auth, it
 * names the OpenAPI document, the MCP endpoint and the agents page, and an
 * operation added to the table appears in it with no edit to the text.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { llmsTxt } from "../src/api-v1/llms.js";
import {
	type AnyOperation,
	typedOperations,
} from "../src/api-v1/operations.js";
import { bootServer } from "./boot-server.js";

const DATA_DIR = join(tmpdir(), `notara-llms-${process.pid}`);

const { proc: server, base: BASE } = await bootServer((base) => ({
	DATA_DIR,
	BASE_URL: base,
	BETTER_AUTH_SECRET: "test-secret-for-llms-txt-checks-only",
	ADMIN_EMAILS: "",
}));

afterAll(() => {
	server?.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
});

describe("GET /llms.txt", () => {
	test("is text/plain, needs no auth, links OpenAPI, MCP and the agents page", async () => {
		const res = await fetch(`${BASE}/llms.txt`);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/plain");
		const body = await res.text();
		expect(body).toContain(`${BASE}/api/v1/openapi.json`);
		expect(body).toContain(`${BASE}/mcp`);
		expect(body).toContain(`${BASE}/agents`);
	});

	test("lists every operation of the table under its scope", async () => {
		const body = await (await fetch(`${BASE}/llms.txt`)).text();
		const [read, write] = body.split("## Write operations");
		for (const op of typedOperations)
			expect(op.scope === "read" ? read : write).toContain(
				`- ${op.operationId}:`,
			);
	});
});

describe("llmsTxt", () => {
	test("an operation added to the table shows up with no text edit", () => {
		const extra = {
			operationId: "frobnicateWidget",
			summary: "Frobnicate a\n widget",
			scope: "write",
		} as AnyOperation;
		expect(llmsTxt(typedOperations, "http://x")).not.toContain(
			"frobnicateWidget",
		);
		const out = llmsTxt([...typedOperations, extra], "http://x");
		expect(out).toContain("- frobnicateWidget: Frobnicate a widget");
		expect(out.indexOf("frobnicateWidget")).toBeGreaterThan(
			out.indexOf("## Write operations"),
		);
	});
});
