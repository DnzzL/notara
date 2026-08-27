/**
 * A read key cannot write, and a write key still can.
 *
 * Enforcement is one chokepoint — the v1 router refuses any non-GET carried by
 * a read key — rather than a check written into each of the twenty-eight
 * operations. `test/api-key-scopes.test.ts` asserts the invariant that makes
 * that sound (no GET mutates); these tests assert the refusal actually reaches
 * a real request, over the wire, against a running server.
 *
 * The requests here carry the key and no cookie. A cookie session is unscoped
 * by construction — it is the user themselves — so a browser context would
 * prove nothing about the key.
 */
import { request } from "@playwright/test";
import { APP_ORIGIN, expect, seedPage, test } from "./multiuser-helpers.js";

/** A request context that authenticates only with the given key. */
const withKey = (rawKey: string) =>
	request.newContext({
		baseURL: APP_ORIGIN,
		extraHTTPHeaders: { authorization: `Bearer ${rawKey}` },
	});

test("a read key is refused on a mutation and still allowed on a read", async ({
	alice,
	soloWs,
}) => {
	const { pageId } = await seedPage(alice, soloWs, "Scoped", ["Seed"]);
	const key = await alice.rpc<{ rawKey: string; scope: string }>(
		"createApiKey",
		{ name: "e2e read", scope: "read" },
	);
	expect(key.scope).toBe("read");

	const api = await withKey(key.rawKey);
	const base = `/api/v1/workspaces/${soloWs.workspaceId}`;

	const read = await api.get(`${base}/pages/${pageId}/blocks`);
	expect(read.status(), await read.text()).toBe(200);

	const write = await api.post(`${base}/pages/${pageId}/blocks`, {
		data: { type: "paragraph", content: "<p>should not land</p>", index: 0 },
	});
	// 403, not 401: the key is valid, it simply may not do this.
	expect(write.status()).toBe(403);
	expect(await write.text()).toContain("read-only");

	// The refusal came before the handler, so nothing was written.
	const after = await api.get(`${base}/pages/${pageId}/blocks`);
	const blocks = (await after.json()) as Array<{ content: string }>;
	expect(blocks.some((b) => b.content.includes("should not land"))).toBe(false);

	await api.dispose();
});

test("a write key may still mutate", async ({ alice, soloWs }) => {
	// Without this the test above would pass just as well if scopes refused
	// everything, or if the route were broken for reasons of its own.
	const { pageId } = await seedPage(alice, soloWs, "Unscoped", ["Seed"]);
	const key = await alice.rpc<{ rawKey: string; scope: string }>(
		"createApiKey",
		{ name: "e2e write", scope: "write" },
	);
	expect(key.scope).toBe("write");

	const api = await withKey(key.rawKey);
	const created = await api.post(
		`/api/v1/workspaces/${soloWs.workspaceId}/pages/${pageId}/blocks`,
		{ data: { type: "paragraph", content: "<p>landed</p>", index: 0 } },
	);
	expect(created.status(), await created.text()).toBe(201);

	await api.dispose();
});
