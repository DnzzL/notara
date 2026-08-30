import { expect, test } from "@playwright/test";
import { caretToBlockStart, createPage, gotoApp } from "./helpers.js";

/**
 * Inter-block operations address the block you are typing in (NOT-stale-index)
 *
 * Every block editor is its own TipTap instance, and `useEditor` is called with
 * an empty deps array — so `BlockNavigationExtension.configure({ blockIndex })`
 * is frozen at mount. `Editor.setOptions` does not rebuild the extension
 * manager, so the keyboard shortcuts keep the index the block had when it was
 * created.
 *
 * Insert a block ABOVE an existing one and every later block's Enter/Backspace
 * then acts on its neighbour: Enter rewrites another block's content, Backspace
 * deletes another block outright. That is how a page loses paragraphs nobody
 * touched.
 */
test.describe("Block operations after an insertion above", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	test("Enter splits the focused block, not the one at its mount index", async ({
		page,
	}) => {
		const editor = await createPage(page, "Stale Index Enter");
		const blocks = page.locator(".ProseMirror");

		await editor.click();
		await editor.pressSequentially("one");
		await editor.press("Enter");
		await expect(blocks).toHaveCount(2, { timeout: 10000 });
		await page.keyboard.type("three");
		await expect(blocks.nth(1)).toHaveText("three", { timeout: 10000 });

		// Insert an empty block between the two. "three" is now at index 2 while
		// its editor was mounted at index 1.
		await blocks.nth(0).click();
		await blocks.nth(0).press("End");
		await blocks.nth(0).press("Enter");
		await expect(blocks).toHaveCount(3, { timeout: 10000 });

		// Split the last block at its end: a new empty block should follow it,
		// and nothing else should change.
		await blocks.nth(2).click();
		await blocks.nth(2).press("End");
		await blocks.nth(2).press("Enter");
		await expect(blocks).toHaveCount(4, { timeout: 10000 });

		await page.keyboard.type("four");
		await expect(blocks.nth(3)).toHaveText("four", { timeout: 10000 });
		await expect(blocks.nth(0)).toHaveText("one", { timeout: 10000 });
		await expect(blocks.nth(1)).toHaveText("");
		await expect(blocks.nth(2)).toHaveText("three");
		await expect(blocks.nth(3)).toHaveText("four");
	});

	test("Backspace merges the focused block into its previous one", async ({
		page,
	}) => {
		const editor = await createPage(page, "Stale Index Backspace");
		const blocks = page.locator(".ProseMirror");

		await editor.click();
		await editor.pressSequentially("one");
		await editor.press("Enter");
		await expect(blocks).toHaveCount(2, { timeout: 10000 });
		await page.keyboard.type("three");
		await expect(blocks.nth(1)).toHaveText("three", { timeout: 10000 });

		// Insert "two" between them. "three" keeps its mount index of 1.
		await blocks.nth(0).click();
		await blocks.nth(0).press("End");
		await blocks.nth(0).press("Enter");
		await expect(blocks).toHaveCount(3, { timeout: 10000 });
		await page.keyboard.type("two");
		await expect(blocks.nth(1)).toHaveText("two", { timeout: 10000 });

		// Backspace at the start of "three" merges it into "two".
		await caretToBlockStart(page, 2);
		await page.keyboard.press("Backspace");

		await expect(blocks).toHaveCount(2, { timeout: 10000 });
		await expect(blocks.nth(0)).toHaveText("one", { timeout: 10000 });
		await expect(blocks.nth(1)).toHaveText("twothree");
	});
});
