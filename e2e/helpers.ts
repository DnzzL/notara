import { expect, type Locator, type Page } from "@playwright/test";

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
	// The route changes before the old page's DOM is swapped out, so waiting on
	// the URL alone still races. A fresh blank page always starts as "Untitled";
	// waiting for that confirms the new page's own DOM is mounted.
	await expect(page.locator("h1").first()).toHaveText("Untitled", {
		timeout: 10000,
	});
}

/**
 * Set the page title. The title is an <h1>; clicking it reveals the input.
 *
 * Entering edit mode seeds the input from the page in the store, so if the page
 * is still settling the seed can land after our fill and blank it out. Retrying
 * the whole interaction is the reliable way through — asserting the committed
 * <h1> is what makes the retry meaningful.
 */
export async function setPageTitle(page: Page, title: string) {
	await expect(async () => {
		await page.evaluate(() => {
			const h1 = document.querySelector("h1");
			if (h1) (h1 as HTMLElement).click();
		});
		const input = page.locator('input[name="page-title"]');
		await expect(input).toBeVisible({ timeout: 5000 });
		await input.fill(title);
		await input.press("Enter");
		await expect(page.locator("h1").first()).toContainText(title, {
			timeout: 3000,
		});
	}).toPass({ timeout: 20000 });
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

/** The slash menu container. */
export const slashMenu = (page: Page) => page.locator("[data-slash-menu]");

/** Open the slash menu in the given editor, and return the menu locator. */
export async function openSlashMenu(
	page: Page,
	editor = page.locator(".ProseMirror").first(),
) {
	await editor.click();
	await editor.press("Home");
	await editor.press("/");
	const menu = slashMenu(page);
	await expect(menu).toBeVisible({ timeout: 5000 });
	return menu;
}

/** Pick a command from the slash menu by its exact visible name. */
export async function runSlashCommand(page: Page, name: string) {
	const menu = slashMenu(page);
	await menu.getByRole("button").filter({ hasText: name }).first().click();
	await expect(menu).toBeHidden({ timeout: 5000 });
}

/**
 * Add a property to the open database table.
 *
 * The popover is name-then-type-then-Create. Fills the name, picks the type,
 * adds any options, then clicks the Create button.
 */
export async function addField(
	page: Page,
	name: string,
	typeLabel: string,
	options: string[] = [],
) {
	await page.locator('button[title="Add property"]').click();

	const popover = page.locator("[data-add-field]");
	await expect(popover).toBeVisible({ timeout: 10000 });

	const nameInput = popover.locator('input[name="new-property-name"]');
	await nameInput.fill(name);

	// Basic types are always visible. Advanced types (Multi-select, Relation,
	// Formula, People, Page link) require clicking "Show advanced" first.
	const typeOpt = popover.getByText(typeLabel, { exact: true });
	try {
		await typeOpt.click({ timeout: 1000 });
	} catch {
		await popover.getByText("Show advanced").click();
		await page.waitForTimeout(200);
		await typeOpt.click({ timeout: 3000 });
	}

	// Select/multi-select reveal an option editor; each Enter commits one option.
	for (const option of options) {
		const optionInput = popover.getByPlaceholder("Add option");
		await optionInput.fill(option);
		await optionInput.press("Enter");
	}

	// Click Create — the Popover now repositions via ResizeObserver if content
	// grows, so the button is always in the viewport.
	const createBtn = popover.getByRole("button", { name: "Create" });
	await expect(createBtn).toBeVisible({ timeout: 5000 });
	await createBtn.click();
	await expect(popover).toBeHidden({ timeout: 10000 });

	// The new column header appears once the field is persisted.
	await expect(
		page.locator("table thead").getByText(name, { exact: true }),
	).toBeVisible({ timeout: 10000 });
}

/** Insert a database into the current page via the slash menu. */
export async function insertDatabase(page: Page, editor?: Locator) {
	await openSlashMenu(page, editor);
	await runSlashCommand(page, "Database");
	await expect(page.locator("table.w-full")).toBeVisible({ timeout: 10000 });
}

/** Wait for the app shell (sidebar) to be ready. */
export async function gotoApp(page: Page) {
	await page.goto("/");
	await page
		.locator("[data-sidebar]")
		.waitFor({ state: "visible", timeout: 15000 });
}

/**
 * Put the caret at the start of the nth block, and focus it.
 *
 * Neither `Home` nor `Meta+ArrowLeft` is dependable here: `Home` scrolls
 * instead of moving the caret in a macOS contenteditable, and a block that
 * re-renders between the click and the key press comes back with the caret at
 * the end. Setting the selection directly is the only placement that holds,
 * and getting it wrong is silent — Backspace deletes a character instead of
 * merging two blocks.
 */
export async function caretToBlockStart(page: Page, index: number) {
	await page.evaluate((i) => {
		const el = document.querySelectorAll(".ProseMirror")[i] as HTMLElement;
		el.focus();
	}, index);
	// ProseMirror restores its own stored selection when the element takes
	// focus, so the range has to be set after that has happened — not in the
	// same task.
	await page.waitForTimeout(50);
	await page.evaluate((i) => {
		const el = document.querySelectorAll(".ProseMirror")[i] as HTMLElement;
		const range = document.createRange();
		range.setStart(el, 0);
		range.collapse(true);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}, index);
}
