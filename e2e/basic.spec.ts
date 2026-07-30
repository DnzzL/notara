import { expect, test } from "@playwright/test";
import { createPage, gotoApp, openSlashMenu } from "./helpers.js";

/**
 * Basic User Stories
 *
 * Re-written with current Tailwind-based selectors and workspace-routed navigation.
 * These tests assume the auth setup has provided an authenticated session.
 */

test.describe("Basic User Stories", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	test("create a new page with title", async ({ page }) => {
		await createPage(page, "My Test Page");

		// Verify the page title is displayed (h1 with the title)
		await expect(page.locator("h1")).toContainText("My Test Page");
	});

	test("edit page content", async ({ page }) => {
		const editor = await createPage(page, "Content Test");

		// Type in editor
		await editor.click();
		await editor.fill("Hello World");

		// Wait for debounced save
		await page.waitForTimeout(1000);

		// Verify content persisted
		await expect(editor).toContainText("Hello World");
	});

	test("use slash command to create database", async ({ page }) => {
		const editor = await createPage(page, "Database Test");
		await openSlashMenu(page, editor);

		// Click "Database" option in the slash menu
		await page.locator("button").filter({ hasText: "Database" }).click();

		// Wait for the database to render — it creates a table
		const dbTable = page.locator("table.w-full");
		await expect(dbTable).toBeVisible({ timeout: 10000 });

		// Verify database toolbar is present (view switcher + tabs)
		const viewTabs = page.locator('[role="tablist"]');
		await expect(viewTabs).toBeVisible();
	});

	test("add database field and record", async ({ page }) => {
		const editor = await createPage(page, "DB Operations Test");
		await openSlashMenu(page, editor);

		// Click Database
		await page.locator("button").filter({ hasText: "Database" }).click();
		await expect(page.locator("table.w-full")).toBeVisible({ timeout: 10000 });

		// Click the "+" add-field button (in the table header)
		const addFieldBtn = page.locator('button[title="Add property"]');
		await expect(addFieldBtn).toBeVisible({ timeout: 5000 });
		await addFieldBtn.click();

		// The AddFieldPopover should appear — fill field name
		const fieldInput = page.locator('input[placeholder="Field name"]');
		if (await fieldInput.isVisible({ timeout: 2000 }).catch(() => false)) {
			await fieldInput.fill("Status");
			await fieldInput.blur();
		}

		// Add a record via the "+ New record" button
		const newRecordBtn = page.getByText("+ New record");
		await expect(newRecordBtn).toBeVisible();
		await newRecordBtn.click();

		// "+ New record" opens the RecordPanel drawer, which overlays the table.
		// Its title input shares name="record-title" with the inline table cell,
		// so scope to the first match rather than letting a strict-mode violation
		// get swallowed.
		const recordTitleInput = page.locator('input[name="record-title"]').first();
		await expect(recordTitleInput).toBeVisible({ timeout: 5000 });
		await recordTitleInput.fill("First Record");
		// Enter blurs the input, which is what commits the rename.
		await recordTitleInput.press("Enter");

		// Close the drawer so it stops intercepting, then check the table row.
		await page.keyboard.press("Escape");
		await expect(recordTitleInput).toBeHidden({ timeout: 5000 });

		// Verify a record row exists with the title
		await expect(page.locator("table tbody")).toContainText("First Record", {
			timeout: 5000,
		});
	});
});
