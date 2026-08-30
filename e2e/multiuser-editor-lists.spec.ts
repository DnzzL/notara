/**
 * List and todo blocks that hold more than the editor assumes (NOT-list-split)
 *
 * A block is meant to be one list item, but nothing enforces that: an import, a
 * paste, or the REST API can put a five-item `<ul>` in a single block. The
 * split then rebuilt the block's HTML from the cursor's own text node —
 * `<ul><li>before</li></ul>` — and the other four items were gone. Slicing the
 * document instead keeps whatever the block is made of.
 *
 * These live in the "multiuser" project for its fixtures, not for a second
 * user: each test gets its own workspace, can seed a block's exact HTML over
 * RPC, and can read back what the server actually stored.
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

/** Seed a page whose single block holds the given HTML. */
async function pageWithBlock(
	alice: Parameters<typeof fetchBlocks>[0],
	ws: Parameters<typeof fetchBlocks>[1],
	title: string,
	type: string,
	content: string,
) {
	const seeded = await seedPage(alice, ws, title, []);
	await alice.rpc(
		"createBlock",
		{ pageId: seeded.pageId, type, content, index: 0, parentId: null },
		ws.workspaceId,
	);
	await openPage(alice, ws, seeded.pageId);
	return seeded.pageId;
}

test("Enter mid-item keeps the block's other list items", async ({
	alice,
	sharedWs,
}) => {
	const pageId = await pageWithBlock(
		alice,
		sharedWs,
		"Multi Item List",
		"bulletList",
		"<ul><li>one</li><li>two</li><li>three</li></ul>",
	);
	await expect(blockNodes(alice)).toHaveCount(1);

	// Split "two" between the "tw" and the "o".
	await caretInBlock(alice, 0, "two", 2);
	await alice.page.keyboard.press("Enter");
	await expect(blockNodes(alice)).toHaveCount(2, { timeout: 10_000 });

	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, pageId);
		const html = blocks
			.sort((a, b) => a.index - b.index)
			.map((b) => b.content)
			.join("");
		// The siblings the old splitter dropped.
		expect(html).toContain("one");
		expect(html).toContain("three");
		// And the item that was split, in two halves.
		expect(html).toContain("tw");
		expect(html).toContain("o");
	}).toPass({ timeout: 10_000 });
});

test("Backspace at the start of a one-item list leaves the list, and it sticks", async ({
	alice,
	sharedWs,
}) => {
	const pageId = await pageWithBlock(
		alice,
		sharedWs,
		"List To Paragraph",
		"bulletList",
		"<ul><li>hello <strong>there</strong></li></ul>",
	);

	await caretInBlock(alice, 0, "hello ", 0);
	await alice.page.keyboard.press("Backspace");

	// The conversion used to happen in the editor only — never persisted, so it
	// came back as a bullet on reload — and via textContent, so it dropped the
	// bold along the way.
	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, pageId);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].content).toContain("<p>");
		expect(blocks[0].content).not.toContain("<li>");
		expect(blocks[0].content).toContain("<strong>there</strong>");
	}).toPass({ timeout: 10_000 });
});

test("Enter on an empty bullet leaves the list without adding a block", async ({
	alice,
	sharedWs,
}) => {
	const pageId = await pageWithBlock(
		alice,
		sharedWs,
		"Empty Bullet Enter",
		"bulletList",
		"<ul><li></li></ul>",
	);

	await blockEditor(alice, 0).click();
	await alice.page.keyboard.press("Enter");

	// It used to keep the empty bullet AND add an empty paragraph under it.
	await expect(blockNodes(alice)).toHaveCount(1);
	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, pageId);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].content).not.toContain("<li>");
	}).toPass({ timeout: 10_000 });
});

test("Tab keeps the caret in the block, and indents when there is room", async ({
	alice,
	sharedWs,
}) => {
	const pageId = await pageWithBlock(
		alice,
		sharedWs,
		"Tab Indents",
		"bulletList",
		"<ul><li>one</li><li>two</li></ul>",
	);

	// Second item, which has a sibling above it to nest under.
	await caretInBlock(alice, 0, "two", 3);
	await alice.page.keyboard.press("Tab");

	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, pageId);
		// A list nested inside the first item.
		expect(blocks[0].content).toContain("<ul><li><p>one</p><ul>");
	}).toPass({ timeout: 10_000 });

	// The editor still has the caret: Tab used to fall through to the browser
	// and move focus out of the document entirely.
	const stillInside = await alice.page.evaluate(() => {
		const el = document.querySelectorAll(".ProseMirror")[0];
		return el.contains(document.activeElement) || el === document.activeElement;
	});
	expect(stillInside).toBe(true);
});

test("Tab in a single-item block does not move focus out of the editor", async ({
	alice,
	sharedWs,
}) => {
	await pageWithBlock(
		alice,
		sharedWs,
		"Tab Holds Focus",
		"paragraph",
		"<p>alone</p>",
	);

	await blockEditor(alice, 0).click();
	await alice.page.keyboard.press("Tab");
	await alice.page.keyboard.type("!");

	// Nothing to indent, so nothing indents — but the keystroke after it still
	// lands in the block the user was typing in.
	await expect(blockEditor(alice, 0)).toHaveText("alone!");
});

test("Delete at the end of a block pulls the next one up", async ({
	alice,
	sharedWs,
}) => {
	const seeded = await seedPage(alice, sharedWs, "Forward Delete", [
		"head",
		"tail",
	]);
	await openPage(alice, sharedWs, seeded.pageId);
	await expect(blockNodes(alice)).toHaveCount(2);

	await caretInBlock(alice, 0, "head", 4);
	await alice.page.keyboard.press("Delete");

	// Forward-delete at the end used to do nothing: the caret sat against a
	// boundary the reader cannot see.
	await expect(blockNodes(alice)).toHaveCount(1, { timeout: 10_000 });
	await expect(blockEditor(alice, 0)).toHaveText("headtail");
	await expect(async () => {
		const blocks = await fetchBlocks(alice, sharedWs, seeded.pageId);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].content).toContain("headtail");
	}).toPass({ timeout: 10_000 });
});
