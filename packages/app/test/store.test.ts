/**
 * What a store does when an API call fails.
 *
 * This file used to assert `true`. It replaces that with the policy the stores
 * actually depend on — because until NOT-125 there was no policy: nineteen
 * actions in `databaseStore` called the API bare, so a failed rename changed
 * nothing on screen and said nothing, indistinguishable from a rename nobody
 * attempted.
 */
import { describe, expect, mock, test } from "bun:test";
import { AccessDeniedError } from "../src/rpc-client.js";

const toasts: Array<{ title?: string; description?: string }> = [];
mock.module("../src/toaster.js", () => ({
	toaster: {
		create: (t: { title?: string; description?: string }) => {
			toasts.push(t);
		},
	},
}));

const { guarded, reported, showError } = await import(
	"../src/lib/storeErrors.js"
);

const lastToast = () => toasts[toasts.length - 1];

describe("guarded", () => {
	test("returns the value when the call succeeds, and says nothing", () => {
		const before = toasts.length;
		return guarded("Failed", async () => 42).then((v) => {
			expect(v).toBe(42);
			expect(toasts.length).toBe(before);
		});
	});

	test("reports the failure AND rethrows", async () => {
		// Rethrowing is the point: a caller holding an optimistic update has to
		// learn the write failed so it can roll back.
		const before = toasts.length;
		await expect(
			guarded("Failed to create database", async () => {
				throw new Error("network down");
			}),
		).rejects.toThrow("network down");

		expect(toasts.length).toBe(before + 1);
		expect(lastToast().title).toBe("Failed to create database");
		expect(lastToast().description).toContain("network down");
	});
});

describe("reported", () => {
	test("swallows the failure so a caller with no recovery is not rejected into", async () => {
		const before = toasts.length;
		await reported("Failed to load databases", async () => {
			throw new Error("timeout");
		});
		expect(toasts.length).toBe(before + 1);
		expect(lastToast().title).toBe("Failed to load databases");
	});

	test("says nothing when the call succeeds", async () => {
		const before = toasts.length;
		await reported("Failed", async () => "ok");
		expect(toasts.length).toBe(before);
	});
});

describe("showError", () => {
	test("stays silent on an access denial", () => {
		// Those are rendered by the component layer, which knows what the user was
		// trying to reach and can offer more than a toast.
		const before = toasts.length;
		showError("Failed to load page", new AccessDeniedError());
		expect(toasts.length).toBe(before);
	});

	test("reports anything else", () => {
		const before = toasts.length;
		showError("Failed to load page", new Error("500"));
		expect(toasts.length).toBe(before + 1);
	});
});
