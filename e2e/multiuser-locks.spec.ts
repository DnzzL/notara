/**
 * Soft block locks: the concurrency-control story.
 *
 * A block a peer has the caret in is "locked" for ~10s (refreshed by each 5s
 * heartbeat). Two layers enforce it:
 *   - the client turns the block read-only (`editor.setEditable`, BlockEditor.tsx)
 *   - the server rejects writes to a peer-held block with `BlockLocked:<userId>`
 *     (rpc-handlers.ts)
 *
 * The toast in BlockEditor.handleUpdateBlock is only reachable in the narrow race
 * where a debounced save fires between a peer taking the lock and the read-only
 * flag landing, so it is not asserted here; the server-side refusal is tested
 * directly instead.
 */
import {
	blockEditor,
	expect,
	fetchBlocks,
	lockBadge,
	meetOnPage,
	test,
} from "./multiuser-helpers.js";

test("the block a peer has focused is flagged as locked", async ({
	alice,
	bob,
	sharedWs,
}) => {
	await meetOnPage(alice, bob, sharedWs, "Locks Page", [
		"Shared block",
		"Untouched block",
	]);

	await blockEditor(bob, 0).click();

	await expect(lockBadge(alice, 0)).toBeVisible({ timeout: 15_000 });
	await expect(lockBadge(alice, 0)).toHaveAttribute(
		"title",
		`${bob.name} is editing`,
	);
	// Only the focused block is locked.
	await expect(lockBadge(alice, 1)).toBeHidden();
});

test("a peer-locked block is read-only, and typing into it changes nothing", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Locks Page", [
		"Shared block",
		"Untouched block",
	]);

	await blockEditor(bob, 0).click();
	await expect(lockBadge(alice, 0)).toBeVisible({ timeout: 15_000 });

	await expect(blockEditor(alice, 0)).toHaveAttribute(
		"contenteditable",
		"false",
	);
	// Neighbouring blocks stay editable.
	await expect(blockEditor(alice, 1)).toHaveAttribute(
		"contenteditable",
		"true",
	);

	await blockEditor(alice, 0).click();
	await blockEditor(alice, 0).pressSequentially(" ALICE WAS HERE");
	await alice.page.waitForTimeout(2_000);

	await expect(blockEditor(alice, 0)).toHaveText("Shared block");
	const blocks = await fetchBlocks(alice, sharedWs, seeded.pageId);
	expect(blocks[0].content).not.toContain("ALICE WAS HERE");
});

test("the server refuses a write to a peer-locked block", async ({
	alice,
	bob,
	sharedWs,
}) => {
	// Second line of defence: a client that ignores the read-only flag — an API
	// consumer, a stale tab, or the debounced-save race — must still be refused.
	const seeded = await meetOnPage(alice, bob, sharedWs, "Locks Page", [
		"Shared block",
		"Untouched block",
	]);

	await blockEditor(bob, 0).click();
	await expect(lockBadge(alice, 0)).toBeVisible({ timeout: 15_000 });

	await expect(
		alice.rpc(
			"updateBlock",
			{ id: seeded.blockIds[0], content: "<p>written behind the lock</p>" },
			sharedWs.workspaceId,
		),
	).rejects.toThrow();

	const blocks = await fetchBlocks(alice, sharedWs, seeded.pageId);
	expect(blocks[0].content).toContain("Shared block");
});

test("a refused write tells the caller that the block was locked", async ({
	alice,
	bob,
	sharedWs,
}) => {
	// BlockEditor.handleUpdateBlock keys its "<name> is editing this block" toast
	// off the `BlockLocked:` marker in the error message, so a refusal that
	// arrives without a reason cannot be explained to the user.
	const seeded = await meetOnPage(alice, bob, sharedWs, "Locks Page", [
		"Shared block",
		"Untouched block",
	]);

	await blockEditor(bob, 0).click();
	await expect(lockBadge(alice, 0)).toBeVisible({ timeout: 15_000 });

	await expect(
		alice.rpc(
			"updateBlock",
			{ id: seeded.blockIds[0], content: "<p>written behind the lock</p>" },
			sharedWs.workspaceId,
		),
	).rejects.toThrow(/BlockLocked/);
});

test("the lock is released once the peer moves the caret away", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const seeded = await meetOnPage(alice, bob, sharedWs, "Locks Page", [
		"Shared block",
		"Untouched block",
	]);

	await blockEditor(bob, 0).click();
	await expect(lockBadge(alice, 0)).toBeVisible({ timeout: 15_000 });

	// Esc blurs the block, which clears the focused-block heartbeat.
	await bob.page.keyboard.press("Escape");
	await expect(lockBadge(alice, 0)).toBeHidden({ timeout: 20_000 });
	await expect(blockEditor(alice, 0)).toHaveAttribute(
		"contenteditable",
		"true",
	);

	// And the block is writable again.
	await blockEditor(alice, 0).click();
	await blockEditor(alice, 0).pressSequentially(" edited after release");
	await expect
		.poll(
			async () =>
				(await fetchBlocks(alice, sharedWs, seeded.pageId))[0].content,
			{
				timeout: 15_000,
			},
		)
		.toContain("edited after release");
});
