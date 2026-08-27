import { expect, test } from "@playwright/test";
import { createPage, gotoApp } from "./helpers.js";

/**
 * Enter vs Shift+Enter in a paragraph (NOT-84)
 *
 * Enter used to insert a hard break, so typing two lines produced a single
 * block containing `<p>one<br>two</p>` instead of two sibling blocks. Every
 * other block type already split on Enter; the paragraph — the block every
 * new page starts with — did not.
 *
 * Each block is its own TipTap instance, so "how many blocks" is simply how
 * many `.ProseMirror` elements the page renders.
 */
test.describe("Enter in a paragraph", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	test("Enter at the end of a paragraph creates a new block", async ({
		page,
	}) => {
		const editor = await createPage(page, "Enter Splits");

		await editor.click();
		await editor.pressSequentially("one");
		await editor.press("End");
		await editor.press("Enter");

		const blocks = page.locator(".ProseMirror");
		await expect(blocks).toHaveCount(2, { timeout: 10000 });

		// The caret follows into the new block, so typing lands there.
		await page.keyboard.type("two");
		await expect(blocks.nth(0)).toHaveText("one");
		await expect(blocks.nth(1)).toHaveText("two");

		// The regression this guards: both lines inside one block, split by a <br>.
		await expect(blocks.nth(0).locator("br")).toHaveCount(0);
	});

	test("Enter mid-text splits the paragraph in two", async ({ page }) => {
		const editor = await createPage(page, "Enter Mid Text");

		// Build "onetwo" with the caret between the two halves by typing the tail
		// first, then Home, then the head. Arrow keys to place the caret are
		// unreliable here: the debounced save re-renders the block and can swallow
		// them, leaving the caret one character off.
		await editor.click();
		await editor.pressSequentially("two");
		await page.waitForTimeout(400);
		await editor.press("Home");
		await editor.pressSequentially("one");
		await editor.press("Enter");

		const blocks = page.locator(".ProseMirror");
		await expect(blocks).toHaveCount(2, { timeout: 10000 });
		await expect(blocks.nth(0)).toHaveText("one");
		await expect(blocks.nth(1)).toHaveText("two");
	});

	test("Shift+Enter keeps one block and inserts a line break", async ({
		page,
	}) => {
		const editor = await createPage(page, "Shift Enter Breaks");

		await editor.click();
		await editor.pressSequentially("one");
		await editor.press("End");
		await editor.press("Shift+Enter");
		await page.keyboard.type("two");

		const blocks = page.locator(".ProseMirror");
		await expect(blocks).toHaveCount(1);
		await expect(blocks.first().locator("br")).toHaveCount(1);
	});
});

/**
 * Enter mid-item in a list or a todo (NOT-96)
 *
 * The split handed the before/after halves to `splitBlock` but left this editor
 * holding the whole pre-split line. Its own debounced save was still in flight,
 * landed after the split, and wrote the full line back over the truncated first
 * half — so the text ended up in BOTH items.
 *
 * The paragraph branch above was fixed under NOT-84 by truncating first; its
 * comment named these two as the remaining gap.
 */
test.describe("Enter in a list or todo", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	/** Type the tail, go Home, type the head — caret lands at the seam. */
	async function splitMidText(
		editor: import("@playwright/test").Locator,
		head: string,
		tail: string,
	) {
		await editor.pressSequentially(tail);
		await editor.press("Home");
		await editor.pressSequentially(head);
		await editor.press("Enter");
	}

	test("Enter mid-item in a bullet list leaves the head and takes the tail", async ({
		page,
	}) => {
		const editor = await createPage(page, "List Mid Split");

		await editor.click();
		await editor.pressSequentially("- ");
		await splitMidText(editor, "head", "tail");

		const blocks = page.locator(".ProseMirror");
		await expect(blocks).toHaveCount(2, { timeout: 10000 });

		// The regression lands a beat after the split, when the stale save
		// arrives — so these have to hold once the dust settles, not immediately.
		await expect(blocks.nth(0)).toHaveText("head", { timeout: 10000 });
		await expect(blocks.nth(1)).toHaveText("tail", { timeout: 10000 });

		// Still a list, not silently turned into a paragraph.
		await expect(blocks.nth(0).locator("li")).toHaveCount(1);
	});

	// The todo branch of the same fix is NOT covered here. Typing "[] " or "[ ] "
	// — both forms the input rule accepts — does not produce a task list under
	// Playwright, so the test that looked like it covered it was in fact
	// exercising the paragraph branch and asserting nothing about todos. Whether
	// the shortcut works for a real user is an open question: NOT-127.

	test("Enter at the end of a list item still makes an empty sibling", async ({
		page,
	}) => {
		// The path that was already correct. Kept so the fix cannot regress it:
		// at the end there is nothing to truncate, and truncating anyway would
		// blank the item.
		const editor = await createPage(page, "List End Split");

		await editor.click();
		await editor.pressSequentially("- item");
		await editor.press("End");
		await editor.press("Enter");

		const blocks = page.locator(".ProseMirror");
		await expect(blocks).toHaveCount(2, { timeout: 10000 });
		await expect(blocks.nth(0)).toHaveText("item", { timeout: 10000 });
		await expect(blocks.nth(1)).toHaveText("");
	});
});
