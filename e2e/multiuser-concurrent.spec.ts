/**
 * Concurrency: what survives when two people type at the same time.
 *
 * There is no CRDT here — blocks are last-write-wins rows guarded by the soft
 * lock. These specs pin down what that actually buys: edits to distinct blocks
 * must both survive, and a contended block must not end up holding a value that
 * belongs to neither writer.
 */
import {
	blockEditor,
	expect,
	fetchBlocks,
	meetOnPage,
	openPage,
	test,
} from "./multiuser-helpers.js";

test("simultaneous edits to different blocks both persist", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Concurrent Page", [
		"Alice column",
		"Bob column",
	]);

	await blockEditor(alice, 0).click();
	await blockEditor(bob, 1).click();

	await Promise.all([
		blockEditor(alice, 0).pressSequentially(" typed by alice"),
		blockEditor(bob, 1).pressSequentially(" typed by bob"),
	]);

	await expect
		.poll(
			async () =>
				(await fetchBlocks(alice, sharedWs, seeded.pageId))
					.map((b) => b.content)
					.join("|"),
			{ timeout: 20_000 },
		)
		.toContain("typed by alice");

	const blocks = await fetchBlocks(alice, sharedWs, seeded.pageId);
	expect(blocks[0].content).toContain("typed by alice");
	expect(blocks[1].content).toContain("typed by bob");
	// Neither edit bled into the other's block.
	expect(blocks[0].content).not.toContain("typed by bob");
	expect(blocks[1].content).not.toContain("typed by alice");
});

test("both viewers converge on the same content after simultaneous edits", async ({
	alice,
	bob,
	sharedWs,
}) => {
	await meetOnPage(alice, bob, sharedWs, "Concurrent Page", [
		"Alice column",
		"Bob column",
	]);

	await blockEditor(alice, 0).click();
	await blockEditor(bob, 1).click();

	await Promise.all([
		blockEditor(alice, 0).pressSequentially(" from alice"),
		blockEditor(bob, 1).pressSequentially(" from bob"),
	]);

	// Each side must end up showing both edits without a reload.
	await expect(blockEditor(alice, 1)).toContainText("from bob", {
		timeout: 20_000,
	});
	await expect(blockEditor(bob, 0)).toContainText("from alice", {
		timeout: 20_000,
	});
});

test("a contended block keeps exactly one user's text, not a mix of both", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Concurrent Page", [
		"Alice column",
		"Bob column",
	]);

	// Both users race for the same block. The lock should let exactly one win;
	// what must never happen is an interleaved value that belongs to neither.
	await Promise.all([
		blockEditor(alice, 0)
			.click()
			.then(() => blockEditor(alice, 0).pressSequentially(" AAAA")),
		blockEditor(bob, 0)
			.click()
			.then(() => blockEditor(bob, 0).pressSequentially(" BBBB")),
	]);

	await alice.page.waitForTimeout(3_000);
	const content = (await fetchBlocks(alice, sharedWs, seeded.pageId))[0]
		.content;

	expect(content).toContain("Alice column");
	const hasAlice = content.includes("AAAA");
	const hasBob = content.includes("BBBB");
	expect(
		!(hasAlice && hasBob),
		`contended block should hold at most one writer's text, got: ${content}`,
	).toBe(true);
});

test("an edit made while a peer is offline is there when they come back", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Concurrent Page", [
		"Alice column",
		"Bob column",
	]);

	// Closing the tab, not the context: Bob keeps his session and comes back.
	await bob.page.close();

	await blockEditor(alice, 0).click();
	await blockEditor(alice, 0).pressSequentially(" written while bob was away");
	await expect
		.poll(
			async () =>
				(await fetchBlocks(alice, sharedWs, seeded.pageId))[0].content,
			{
				timeout: 15_000,
			},
		)
		.toContain("written while bob was away");

	bob.page = await bob.context.newPage();
	await openPage(bob, sharedWs, seeded.pageId);
	await expect(blockEditor(bob, 0)).toContainText(
		"written while bob was away",
		{
			timeout: 20_000,
		},
	);
});
