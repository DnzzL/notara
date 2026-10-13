/**
 * `/llms.txt` (NOT-164): what an agent reads first on an instance. Every call
 * it shows must be a route that exists, or it teaches agents to fail.
 */
import { describe, expect, test } from "bun:test";
import { llmsTxt } from "../src/api-v1/llms.js";
import { restOperations } from "../src/api-v1/operations.js";

const PREFIX = "/api/v1/workspaces/:workspaceId";

/** `GET /databases/<dbId>/records/NOT-12` → method and a path to match. */
const calls = [
	...llmsTxt.matchAll(/`(GET|POST|PUT|PATCH|DELETE) (\/[^`\s?]*)/g),
].map(([, method, path]) => ({ method, path }));

const routeFor = ({ method, path }: { method: string; path: string }) =>
	restOperations.find((op) => {
		if (op.method !== method) return false;
		const want = op.path.replace(PREFIX, "").split("/");
		const got = path.split("/");
		return (
			want.length === got.length &&
			want.every((w, i) => w.startsWith(":") || w === got[i])
		);
	});

describe("llms.txt", () => {
	test("walks a card's cycle in concrete calls", () => {
		expect(calls.length).toBeGreaterThanOrEqual(6);
		for (const op of [
			"listDatabaseRecords",
			"getRecord",
			"addRecordComment",
			"tickCriterion",
			"updateRecord",
			"createRecord",
		])
			expect(calls.map(routeFor).map((r) => r?.operationId)).toContain(op);
	});

	test("every call it shows is a route", () => {
		// Hand-registered in routes.ts, outside the operation table.
		const listWorkspaces = (c: { path: string }) =>
			c.path === "/api/v1/workspaces";
		expect(calls.filter((c) => !routeFor(c) && !listWorkspaces(c))).toEqual([]);
	});

	test("points to the OpenAPI document and the shared-backlog doc", () => {
		expect(llmsTxt).toContain("/api/v1/openapi.json");
		expect(llmsTxt).toContain("docs/shared-backlog.md");
	});

	test("states the artifact rule", () => {
		expect(llmsTxt).toMatch(/inline/i);
		expect(llmsTxt).toMatch(/no network/i);
	});

	test("names no runner", () => {
		expect(llmsTxt.toLowerCase()).not.toMatch(/docket|herdr/);
	});
});
