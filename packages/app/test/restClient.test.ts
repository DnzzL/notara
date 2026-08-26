/**
 * One transport for the REST-only endpoints.
 *
 * Fourteen call sites issued raw fetches with three different error-extraction
 * shapes between them. The most common one parsed the body as JSON *before*
 * checking the status, so any non-JSON failure — an nginx 502, a proxy timeout
 * page, an HTML 500 — surfaced to the user as "Unexpected token <" instead of
 * what actually went wrong.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { restCall } from "../src/lib/restClient.js";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

/** Stub fetch with one canned response, and capture what was sent. */
function stub(response: Response) {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return response;
	}) as unknown as typeof fetch;
	return calls;
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

describe("restCall", () => {
	test("returns the parsed body on success", async () => {
		stub(json({ key: "backup-1.zip", size: 12 }));
		expect(
			await restCall<{ key: string; size: number }>("/api/backup/trigger"),
		).toEqual({
			key: "backup-1.zip",
			size: 12,
		});
	});

	test("throws the server's message on a JSON failure", async () => {
		stub(json({ error: "S3 bucket is not configured" }, 400));
		await expect(restCall("/api/backup/trigger")).rejects.toThrow(
			"S3 bucket is not configured",
		);
	});

	test("survives a failure body that is not JSON", async () => {
		// The bug this replaces: parsing before checking status turned an nginx
		// 502 into "Unexpected token <" and hid the real problem.
		stub(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
		const failure = restCall("/api/backup/list");
		await expect(failure).rejects.toThrow();
		await expect(failure).rejects.not.toThrow("Unexpected token");
	});

	test("falls back to the status when the body says nothing useful", async () => {
		stub(new Response("", { status: 503, statusText: "Service Unavailable" }));
		await expect(restCall("/api/settings")).rejects.toThrow(/503/);
	});

	test("survives a success body that is not JSON", async () => {
		// DELETE endpoints answer 204 with no body; parsing it must not throw.
		stub(new Response("", { status: 204 }));
		expect(
			await restCall<null>("/api/admin/users/u1", { method: "DELETE" }),
		).toBe(null);
	});

	test("passes method, headers and body through", async () => {
		const calls = stub(json({ ok: true }));
		await restCall("/api/settings", {
			method: "POST",
			body: JSON.stringify({ s3Enabled: true }),
		});
		expect(calls[0].url).toBe("/api/settings");
		expect(calls[0].init?.method).toBe("POST");
		const sentHeaders = calls[0].init?.headers as Record<string, string>;
		expect(sentHeaders["Content-Type"]).toBe("application/json");
	});

	test("does not force a content type on a body that is not JSON", async () => {
		// Upload and import send raw bytes with their own content type.
		const calls = stub(json({ ok: true }));
		await restCall("/api/upload", {
			method: "POST",
			body: new Uint8Array([1, 2, 3]),
			headers: { "Content-Type": "image/png" },
		});
		const sentHeaders = calls[0].init?.headers as Record<string, string>;
		expect(sentHeaders["Content-Type"]).toBe("image/png");
	});
});
