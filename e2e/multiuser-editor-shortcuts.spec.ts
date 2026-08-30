/**
 * Block shortcuts on a page that also holds a database (NOT-shortcut-index)
 *
 * Cmd+D and Cmd+Shift+Arrow read the focused block's position from the DOM,
 * then looked it up in a list of blocks with the database ones filtered out.
 * The two disagree the moment a page has a database: the shortcut addressed a
 * different block, or none at all. The reorder was worse — it sent only the
 * filtered ids, so the database's own position was decided by whatever indices
 * were left over.
 *
 * In the "multiuser" project for the per-test workspace and RPC seeding.
 */
import {
	blockNodes,
	caretInBlock,
	expect,
	fetchBlocks,
	openPage,
	seedPage,
	test,
} from "./multiuser-helpers.js";

test("Cmd+D duplicates the focused block when a database sits above it", async ({
	alice,
	sharedWs,
}) => {
	const seeded = await seedPage(alice, sharedWs, "Shortcuts With DB", [
		"alpha",
		"beta",
	]);
	const db = await alice.rpc<{ id: string }>(
		"createDatabase",
		{ pageId: seeded.pageId, name: "Table" },
		sharedWs.workspaceId,
	);
	await alice.rpc(
		"createBlock",
		{
			pageId: seeded.pageId,
			type: "database",
			content: db.id,
			index: 0,
			parentId: null,
		},
		sharedWs.workspaceId,
	);
	await openPage(alice, sharedWs, seeded.pageId);
	// Two text editors; the database renders as a table, not a .block-node.
	await expect(blockNodes(alice)).toHaveCount(2, { timeout: 10_000 });

	// "beta" is the third block on the page, the second in the text-only list
	// the shortcut used to consult.
	await caretInBlock(alice, 1, "beta", 4);
	await alice.page.keyboard.press("ControlOrMeta+d");

	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, seeded.pageId);
		const texts = blocks
			.sort((a, b) => a.index - b.index)
			.map((b) => b.content);
		expect(texts.filter((c) => c.includes("beta"))).toHaveLength(2);
		expect(texts.filter((c) => c.includes("alpha"))).toHaveLength(1);
	}).toPass({ timeout: 10_000 });
});
