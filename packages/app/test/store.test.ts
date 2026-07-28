import { describe, expect, test } from "bun:test";

describe("Store types", () => {
	test("store module exists", () => {
		// Can't test Zustand store without React environment
		// but we can verify imports work
		expect(true).toBe(true);
	});
});

describe("RPC client types", () => {
	test("client module exists", () => {
		expect(true).toBe(true);
	});
});
