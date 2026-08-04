/**
 * Live sync: does a peer's change reach the other viewer without a reload?
 *
 * The server broadcasts block.created / block.updated / block.deleted /
 * block.reordered / page.metaUpdated on the page's SSE channel; the receiving
 * client folds them into the block store (presenceConnection.ts).
 *
 * Text edits and the page rename are driven through the UI; structural changes
 * (create/delete/reorder) go over RPC, since their UI gestures are drag-and-drop
 * and keystroke-merge flows that belong to their own specs. What is under test
 * here is the broadcast → receiver path.
 */
import {
	blockEditor,
	blockNodes,
	expect,
	meetOnPage,
	test,
} from "./multiuser-helpers.js";

test("a peer's text edit appears in the other viewer", async ({
	alice,
	bob,
	sharedWs,
}) => {
	await meetOnPage(alice, bob, sharedWs, "Live Sync Page", [
		"Alpha",
		"Beta",
		"Gamma",
	]);

	await blockEditor(bob, 1).click();
	await blockEditor(bob, 1).pressSequentially(" edited by bob");

	await expect(blockEditor(alice, 1)).toContainText("Beta edited by bob", {
		timeout: 15_000,
	});
});

test("a block a peer adds appears in the other viewer", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Live Sync Page", [
		"Alpha",
		"Beta",
		"Gamma",
	]);

	await bob.rpc(
		"createBlock",
		{
			pageId: seeded.pageId,
			type: "paragraph",
			content: "<p>Delta from bob</p>",
			index: 3,
			parentId: null,
		},
		sharedWs.workspaceId,
	);

	await expect(blockNodes(alice)).toHaveCount(4, { timeout: 15_000 });
	await expect(blockEditor(alice, 3)).toContainText("Delta from bob", {
		timeout: 15_000,
	});
});

test("a block a peer deletes disappears from the other viewer", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Live Sync Page", [
		"Alpha",
		"Beta",
		"Gamma",
	]);

	await bob.rpc(
		"deleteBlock",
		{ id: seeded.blockIds[1] },
		sharedWs.workspaceId,
	);

	await expect(blockNodes(alice)).toHaveCount(2, { timeout: 15_000 });
	await expect(
		alice.page.locator(".block-node", { hasText: "Beta" }),
	).toHaveCount(0);
});

test("a reorder by a peer reaches the other viewer", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Live Sync Page", [
		"Alpha",
		"Beta",
		"Gamma",
	]);
	const [first, second, third] = seeded.blockIds;

	await bob.rpc(
		"reorderBlocks",
		{ pageId: seeded.pageId, blockIds: [third, first, second] },
		sharedWs.workspaceId,
	);

	await expect(blockEditor(alice, 0)).toContainText("Gamma", {
		timeout: 15_000,
	});
	await expect(blockEditor(alice, 1)).toContainText("Alpha");
	await expect(blockEditor(alice, 2)).toContainText("Beta");
});

test("a page rename by a peer updates the other viewer's header", async ({
	alice,
	bob,
	sharedWs,
}) => {
	await meetOnPage(alice, bob, sharedWs, "Live Sync Page", [
		"Alpha",
		"Beta",
		"Gamma",
	]);

	await bob.page.locator("h1").click();
	const titleInput = bob.page.locator('input[name="page-title"]');
	await expect(titleInput).toBeVisible({ timeout: 5_000 });
	await titleInput.fill("Renamed by Bob");
	await titleInput.press("Enter");

	await expect(alice.page.locator("h1")).toContainText("Renamed by Bob", {
		timeout: 15_000,
	});
});

test("receiving a peer's focus and edits does not crash the viewer (NOT-39 / NOT-40)", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const pageErrors: string[] = [];
	alice.page.on("pageerror", (err) => pageErrors.push(err.message));

	await meetOnPage(alice, bob, sharedWs, "Live Sync Page", [
		"Alpha",
		"Beta",
		"Gamma",
	]);

	// The historical crash was a React insertBefore against the BubbleMenu node
	// when a peer's focus toggled the lock badge on a mounted block.
	for (const index of [0, 1, 2]) {
		await blockEditor(bob, index).click();
		await blockEditor(bob, index).pressSequentially(" x");
		await bob.page.keyboard.press("Escape");
		await alice.page.waitForTimeout(1_000);
	}

	expect(pageErrors).toEqual([]);
	// Alice's editor must still be functional after all that remote traffic.
	await expect(blockNodes(alice)).toHaveCount(3);
	await blockEditor(alice, 0).click();
	await blockEditor(alice, 0).pressSequentially(" still typing");
	await expect(blockEditor(alice, 0)).toContainText("still typing");
});
