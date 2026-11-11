import { expect, test } from "@playwright/test";
import { createPage, gotoApp } from "./helpers.js";

/**
 * Tab / Shift-Tab nest a block under the previous one (NOT-140, slice 1).
 *
 * Blocks stay a flat list in the DOM; nesting shows as indentation, so depth
 * is read off the block wrapper's left margin (24px per level).
 */
test("Tab nests, Shift-Tab un-nests, it survives reload, deleting a parent removes children", async ({
	page,
}) => {
	await gotoApp(page);
	const editor = await createPage(page, "Block Nesting");

	await editor.click();
	await editor.pressSequentially("one");
	await editor.press("Enter");
	await page.keyboard.type("two");
	await page.keyboard.press("Enter");
	await page.keyboard.type("three");

	const blocks = page.locator(".ProseMirror");
	await expect(blocks).toHaveCount(3, { timeout: 10000 });
	const wrapper = (i: number) => page.locator("[data-block-id]").nth(i);

	// "three" is focused: Tab nests it under "two", Shift-Tab brings it back.
	await page.keyboard.press("Tab");
	await expect(wrapper(2)).toHaveCSS("margin-left", "24px");
	await page.keyboard.press("Shift+Tab");
	await expect(wrapper(2)).toHaveCSS("margin-left", "0px");

	// "two" under "one".
	await blocks.nth(1).click();
	await page.keyboard.press("Tab");
	await expect(wrapper(1)).toHaveCSS("margin-left", "24px");
	await expect(wrapper(2)).toHaveCSS("margin-left", "0px");

	// Saved: still nested after a reload.
	await page.waitForTimeout(500);
	await page.reload();
	await expect(page.locator(".ProseMirror")).toHaveCount(3, { timeout: 10000 });
	await expect(wrapper(1)).toHaveCSS("margin-left", "24px");

	// Deleting the parent takes its child with it.
	await wrapper(0).locator(".ProseMirror").click({ button: "right" });
	await page.getByRole("menuitem", { name: /Delete/ }).click();
	await expect(page.locator(".ProseMirror")).toHaveCount(1, { timeout: 10000 });
	await expect(page.locator(".ProseMirror").first()).toHaveText("three");
	await page.reload();
	await expect(page.locator(".ProseMirror")).toHaveCount(1, { timeout: 10000 });
});
