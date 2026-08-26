/**
 * One block-content contract, whichever door you come through.
 *
 * Content is stored as a string whose reading depends on the block type. The
 * REST adapter used to `JSON.parse` it on the way out and fall back to the raw
 * string when that failed, so it returned an object for an image and a string
 * for a paragraph while RPC returned the string either way — one module, two
 * contracts, chosen by the caller's door.
 *
 * These tests assert the two surfaces now return the identical string, and that
 * the write path refuses the object shape the OpenAPI document used to promise
 * (which stored `{"text":"hi"}` where the editor expects `<p>hi</p>`, producing
 * a block that renders blank).
 */
import { expect, seedPage, test } from "./multiuser-helpers.js";

const v1 = (workspaceId: string, suffix: string) =>
	`/api/v1/workspaces/${workspaceId}/${suffix}`;

test("a block written over REST reads back identically over RPC", async ({
	alice,
	soloWs,
}) => {
	const { pageId } = await seedPage(alice, soloWs, "Contract", ["Seed"]);
	const html = "<p>Written over REST</p>";

	const created = await alice.api.post(
		v1(soloWs.workspaceId, `pages/${pageId}/blocks`),
		{ data: { type: "paragraph", content: html, index: 0 } },
	);
	if (!created.ok())
		throw new Error(`create ${created.status()}: ${await created.text()}`);
	const restBlock = (await created.json()) as { id: string; content: string };

	expect(restBlock.content).toBe(html);

	const rpcBlocks = await alice.rpc<Array<{ id: string; content: string }>>(
		"listBlocks",
		{ pageId },
		soloWs.workspaceId,
	);
	const sameBlock = rpcBlocks.find((b) => b.id === restBlock.id);
	expect(sameBlock?.content).toBe(html);
});

test("a structured block keeps its JSON as a string on both surfaces", async ({
	alice,
	soloWs,
}) => {
	// The case that used to diverge: REST parsed this one into an object because
	// JSON.parse happened to succeed, while RPC returned the string.
	const { pageId } = await seedPage(alice, soloWs, "Structured", ["Seed"]);
	const json = JSON.stringify({ pageId, caption: "a link" });

	const created = await alice.api.post(
		v1(soloWs.workspaceId, `pages/${pageId}/blocks`),
		{ data: { type: "pageLink", content: json, index: 0 } },
	);
	if (!created.ok())
		throw new Error(`create ${created.status()}: ${await created.text()}`);
	const restBlock = (await created.json()) as { id: string; content: unknown };

	expect(typeof restBlock.content).toBe("string");
	expect(restBlock.content).toBe(json);

	const rpcBlocks = await alice.rpc<Array<{ id: string; content: string }>>(
		"listBlocks",
		{ pageId },
		soloWs.workspaceId,
	);
	expect(rpcBlocks.find((b) => b.id === restBlock.id)?.content).toBe(json);
});

test("an object payload is refused instead of silently corrupting the block", async ({
	alice,
	soloWs,
}) => {
	// What the OpenAPI document used to promise. Accepting it stored
	// {"text":"hi"} where the editor expects <p>hi</p>, so the block rendered
	// blank and nothing said why.
	const { pageId } = await seedPage(alice, soloWs, "Refusal", ["Seed"]);

	const res = await alice.api.post(
		v1(soloWs.workspaceId, `pages/${pageId}/blocks`),
		{ data: { type: "paragraph", content: { text: "hi" }, index: 0 } },
	);

	expect(res.status()).toBe(400);
	// The refusal has to say what to send, or it just moves the confusion.
	expect(await res.text()).toContain("must be a string");
});

test("REST edits are visible to RPC unchanged", async ({ alice, soloWs }) => {
	const { pageId } = await seedPage(alice, soloWs, "Edited", ["Seed"]);

	const created = await alice.api.post(
		v1(soloWs.workspaceId, `pages/${pageId}/blocks`),
		{ data: { type: "paragraph", content: "<p>before</p>", index: 0 } },
	);
	const { id } = (await created.json()) as { id: string };

	const updated = await alice.api.patch(
		v1(soloWs.workspaceId, `blocks/${id}`),
		{
			data: { content: "<p>after</p>" },
		},
	);
	if (!updated.ok())
		throw new Error(`update ${updated.status()}: ${await updated.text()}`);
	expect(((await updated.json()) as { content: string }).content).toBe(
		"<p>after</p>",
	);

	const rpcBlocks = await alice.rpc<Array<{ id: string; content: string }>>(
		"listBlocks",
		{ pageId },
		soloWs.workspaceId,
	);
	expect(rpcBlocks.find((b) => b.id === id)?.content).toBe("<p>after</p>");
});
