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
