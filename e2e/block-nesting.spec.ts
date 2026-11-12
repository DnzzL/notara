import { expect, type Page, test } from "@playwright/test";
import { createPage, gotoApp } from "./helpers.js";

/**
 * Tab / Shift-Tab nest a block under the previous one (NOT-140, slice 1).
 *
 * Blocks stay a flat list in the DOM; nesting shows as indentation, so depth
 * is read off the block wrapper's left margin (24px per level).
 */
const wrapper = (page: Page, i: number) =>
	page.locator("[data-block-id]").nth(i);

/** Three blocks "one", "two", "three", with "two" nested under "one". */
async function pageWithTwoUnderOne(page: Page) {
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

	// "three" is focused: Tab nests it under "two", Shift-Tab brings it back.
	await page.keyboard.press("Tab");
	await expect(wrapper(page, 2)).toHaveCSS("margin-left", "24px");
	await page.keyboard.press("Shift+Tab");
	await expect(wrapper(page, 2)).toHaveCSS("margin-left", "0px");

	// "two" under "one".
	await blocks.nth(1).click();
	await page.keyboard.press("Tab");
	await expect(wrapper(page, 1)).toHaveCSS("margin-left", "24px");
	await expect(wrapper(page, 2)).toHaveCSS("margin-left", "0px");
}

const deleteFirstBlock = async (page: Page) => {
	await wrapper(page, 0).locator(".ProseMirror").click({ button: "right" });
	// The block leaves the screen at once; the undo entry exists only once the
	// server has confirmed, so wait for that before anything presses Cmd+Z.
	const deleted = page.waitForResponse(
		(r) =>
			r.url().endsWith("/api") &&
			!!r.request().postData()?.includes("deleteBlock"),
	);
	await page.getByRole("menuitem", { name: /Delete/ }).click();
	await deleted;
};

test("Tab nests, Shift-Tab un-nests, it survives reload, deleting a parent removes children", async ({
	page,
}) => {
	await pageWithTwoUnderOne(page);

	// Saved: still nested after a reload.
	await page.waitForTimeout(500);
	await page.reload();
	await expect(page.locator(".ProseMirror")).toHaveCount(3, { timeout: 10000 });
	await expect(wrapper(page, 1)).toHaveCSS("margin-left", "24px");

	// Deleting the parent takes its child with it, on the server too.
	await deleteFirstBlock(page);
	await expect(page.locator(".ProseMirror")).toHaveCount(1, { timeout: 10000 });
	await page.reload();
	await expect(page.locator(".ProseMirror")).toHaveCount(1, { timeout: 10000 });
	await expect(page.locator(".ProseMirror").first()).toHaveText("three");
});

test("Undo of deleting a parent brings its child back, still nested", async ({
	page,
}) => {
	await pageWithTwoUnderOne(page);
	await deleteFirstBlock(page);
	await expect(page.locator(".ProseMirror")).toHaveCount(1, { timeout: 10000 });

	// Outside an editor, Cmd+Z is the block-level undo (inside one it is text undo).
	await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
	await page.keyboard.press("ControlOrMeta+z");
	await expect(page.locator(".ProseMirror")).toHaveCount(3, { timeout: 10000 });
	await expect(wrapper(page, 1)).toHaveCSS("margin-left", "24px");

	await page.reload();
	await expect(page.locator(".ProseMirror")).toHaveCount(3, { timeout: 10000 });
	await expect(wrapper(page, 1)).toHaveCSS("margin-left", "24px");
});

test("Move down carries a parent's children and survives reload", async ({
	page,
}) => {
	await pageWithTwoUnderOne(page); // one ⊃ two, then three
	await wrapper(page, 0).locator(".ProseMirror").click({ button: "right" });
	const moved = page.waitForResponse(
		(r) =>
			r.url().endsWith("/api") &&
			!!r.request().postData()?.includes("moveBlock"),
	);
	await page.getByRole("menuitem", { name: /Move down/ }).click();
	await moved;

	const check = async () => {
		await expect(page.locator(".ProseMirror")).toHaveText(
			["three", "one", "two"],
			{ timeout: 10000 },
		);
		await expect(wrapper(page, 1)).toHaveCSS("margin-left", "0px");
		await expect(wrapper(page, 2)).toHaveCSS("margin-left", "24px");
	};
	await check();
	await page.reload();
	await check();
});

test("Dragging a parent below another block carries its children", async ({
	page,
}) => {
	await pageWithTwoUnderOne(page); // one ⊃ two, then three
	await wrapper(page, 0).hover();
	const handle = wrapper(page, 0).getByTitle(/drag to reorder/);
	const from = await handle.boundingBox();
	const to = await wrapper(page, 2).boundingBox();
	if (!from || !to) throw new Error("no boxes");
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(from.x + 5, from.y + 20, { steps: 5 });
	await page.mouse.move(to.x + 40, to.y + to.height / 2 + 4, { steps: 15 });
	await page.mouse.up();

	const check = async () => {
		await expect(page.locator(".ProseMirror")).toHaveText(
			["three", "one", "two"],
			{ timeout: 10000 },
		);
		await expect(wrapper(page, 1)).toHaveCSS("margin-left", "0px");
		await expect(wrapper(page, 2)).toHaveCSS("margin-left", "24px");
	};
	await check();
	await page.reload();
	await check();
});

test("a nested numbered list restarts at 1 under its parent", async ({
	page,
}) => {
	await gotoApp(page);
	const editor = await createPage(page, "Nested numbering");
	await editor.click();
	await editor.pressSequentially("1. one");
	await page.keyboard.press("Enter");
	await page.keyboard.type("two");
	await page.keyboard.press("Enter");
	await page.keyboard.type("a");
	await page.keyboard.press("Enter");
	await page.keyboard.type("b");
	await page.keyboard.press("Enter");
	await page.keyboard.type("three");
	await expect(page.locator(".ProseMirror")).toHaveCount(5, { timeout: 10000 });

	// "a" and "b" both nest under "two" (Tab goes under the previous top-level block).
	await page.locator(".ProseMirror").nth(2).click();
	await page.keyboard.press("Tab");
	await page.locator(".ProseMirror").nth(3).click();
	await page.keyboard.press("Tab");
	await expect(wrapper(page, 3)).toHaveCSS("margin-left", "24px");

	const run = (i: number) =>
		wrapper(page, i).evaluate((el) =>
			getComputedStyle(el).getPropertyValue("--numbered-run").trim(),
		);
	// Outer 1, 2, nested 1, 2, outer continues at 3.
	const runs = await Promise.all([0, 1, 2, 3, 4].map(run));
	expect(runs).toEqual(["1", "2", "1", "2", "3"]);
});
