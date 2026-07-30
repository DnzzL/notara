import { expect, type Page } from "@playwright/test";

/**
 * Shared page-creation flow.
 *
 * Creating a page takes three steps that are easy to miss:
 *   1. [data-new-page] opens a "Choose a template" dialog — it does not create
 *      a page directly. The dialog is a fixed inset-0 overlay, so while it is
 *      open every other click on the page is intercepted.
 *   2. The title renders as an <h1>; the input only mounts once it is clicked.
 *   3. A blank page has no blocks, so no .ProseMirror exists until the empty
 *      state is clicked.
 *
 * These helpers were extracted from visual-regression.spec.ts, which was the
 * only spec kept in step with the app.
 */

/** Click [data-new-page], then pick "Blank page" from the template dialog. */
export async function createBlankPage(page: Page) {
	const before = page.url();
	// Clicking via evaluate() sidesteps overlays that intercept pointer events.
	await page.evaluate(() => {
		const btn = document.querySelector("[data-new-page]");
		if (btn) (btn as HTMLElement).click();
	});
	const blankPage = page.getByText("Blank page");
	await expect(blankPage).toBeVisible({ timeout: 10000 });
	await blankPage.click();
	// The template dialog intercepts pointer events until it unmounts.
	await expect(blankPage).toBeHidden({ timeout: 10000 });
	// Each page gets its own route. Without waiting for it, the helpers below
	// race the old page's DOM and set the title on the page we just left.
	await page.waitForURL((u) => u.href !== before, { timeout: 10000 });
	await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });
}

/** Set the page title. The title is an <h1>; clicking it reveals the input. */
export async function setPageTitle(page: Page, title: string) {
	await page.evaluate(() => {
		const h1 = document.querySelector("h1");
		if (h1) (h1 as HTMLElement).click();
	});
	const input = page.locator('input[name="page-title"]');
	await expect(input).toBeVisible({ timeout: 10000 });
	await input.fill(title);
	await input.press("Enter");
	// Confirm the rename committed before callers act on the page.
	await expect(page.locator("h1").first()).toContainText(title, {
		timeout: 10000,
	});
}

/** Ensure the page has at least one block, and return the editor locator. */
export async function ensureEditor(page: Page) {
	const editor = page.locator(".ProseMirror");
	if (await editor.count()) return editor.first();

	const emptyState = page.getByText("This page is empty");
	if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
		await emptyState.click();
	} else {
		const newBlock = page.getByRole("button", { name: /New block/ });
		if (await newBlock.count()) await newBlock.first().click();
	}
	await editor.first().waitFor({ state: "visible", timeout: 10000 });
	return editor.first();
}

/** Create a titled page with an editable first block. Returns the editor. */
export async function createPage(page: Page, title: string) {
	await createBlankPage(page);
	await setPageTitle(page, title);
	return ensureEditor(page);
}

/** Open the slash menu in the given editor. */
export async function openSlashMenu(
	page: Page,
	editor = page.locator(".ProseMirror").first(),
) {
	await editor.click();
	await editor.press("Home");
	await editor.press("/");
	await page
		.locator("text=Blocks")
		.first()
		.waitFor({ state: "visible", timeout: 5000 });
}

/** Wait for the app shell (sidebar) to be ready. */
export async function gotoApp(page: Page) {
	await page.goto("/");
	await page
		.locator("[data-sidebar]")
		.waitFor({ state: "visible", timeout: 15000 });
}
