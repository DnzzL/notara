/**
 * Cmd+Z inside a block (NOT-undo-double)
 *
 * The global shortcut handler runs the block-level undo — which DELETES the
 * last created block — and its comment claimed TipTap would have consumed the
 * event first when a block has focus. It does not: ProseMirror calls
 * preventDefault, but the event still bubbles to the window listener. So one
 * Cmd+Z ran the editor's text undo AND removed a block.
 *
 * In the "multiuser" project for the per-test workspace and the server-side
 * read-back, not for a second user.
 */
import {
	blockEditor,
	blockNodes,
	caretInBlock,
	expect,
	fetchBlocks,
	openPage,
	seedPage,
	test,
} from "./multiuser-helpers.js";

test("Cmd+Z while editing a block undoes text, not the block", async ({
	alice,
	sharedWs,
}) => {
	const seeded = await seedPage(alice, sharedWs, "Undo In Block", ["first"]);
	await openPage(alice, sharedWs, seeded.pageId);

	// The second block has to be created through the editor: that is what puts
	// a "create" on the block-level undo stack for Cmd+Z to pop.
	await caretInBlock(alice, 0, "first", "first".length);
	await alice.page.keyboard.press("Enter");
	await expect(blockNodes(alice)).toHaveCount(2, { timeout: 10_000 });
	await alice.page.keyboard.type("second");
	await expect(blockEditor(alice, 1)).toHaveText("second");
	await alice.page.waitForTimeout(400);

	await alice.page.keyboard.press("ControlOrMeta+z");

	// Both blocks are still here — the undo belongs to the text.
	await expect(blockNodes(alice)).toHaveCount(2);
	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, seeded.pageId);
		expect(blocks).toHaveLength(2);
	}).toPass({ timeout: 10_000 });
});
