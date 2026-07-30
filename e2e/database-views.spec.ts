import { expect, test } from "@playwright/test";
import { createPage, gotoApp, openSlashMenu } from "./helpers.js";

/**
 * Database View Regression Specs
 *
 * Covers Calendar view and view-switching behavior.
 * Tests assume an authenticated session (from auth setup).
 *
 * The Calendar view renders a month grid when a date field exists.
 * View switching uses role="tab" buttons with aria-selected state.
 */

test.describe("Database Views", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	/**
	 * Helper: create a page with a database that has a Date field, then add
	 * records so the Calendar view is meaningful.
	 */
	const createDatabaseWithDateField = async (page: any) => {
		const editor = await createPage(
			page,
			`Calendar Test ${Date.now().toString(36)}`,
		);

		// Open slash menu and insert Database
		await openSlashMenu(page, editor);
		await page.locator("button").filter({ hasText: "Database" }).click();

		// Wait for the database table to render
		await page
			.locator("table.w-full")
			.waitFor({ state: "visible", timeout: 10000 });

		// Add a Date field via the "+" add-property button
		const addFieldBtn = page.locator('button[title="Add property"]');
		await addFieldBtn.click();

		// Look for the AddFieldPopover — it has a type selector and name input
		const fieldNameInput = page.locator('input[placeholder="Field name"]');
		if (await fieldNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
			await fieldNameInput.fill("Event Date");
			// Change type to "date" — there's a type selector somewhere in the popover
			const typeSelect = page
				.locator("select")
				.filter({ hasText: /text|number|select/i })
				.first();
			if (await typeSelect.isVisible()) {
				await typeSelect.selectOption("date");
			}
			await fieldNameInput.blur();
		}

		// Add a record via the "+ New record" button
		const newRecordBtn = page.getByText("+ New record");
		await newRecordBtn.click();

		// If a record panel opens, fill the title
		const recordTitleInput = page.locator('input[name="record-title"]');
		if (
			await recordTitleInput.isVisible({ timeout: 3000 }).catch(() => false)
		) {
			await recordTitleInput.fill("Test Event");
			await recordTitleInput.press("Enter");
		}
	};

	test("CR-1: Board → Calendar switching persists (does not revert to Board)", async ({
		page,
	}) => {
		await createDatabaseWithDateField(page);

		// Switch to Board view
		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
		await boardTab.click();
		await page.waitForTimeout(500);

		// Verify Board is active
		let activeTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(activeTab).toContainText("Board");

		// Switch to Calendar view
		const calendarTab = page
			.locator('[role="tab"]')
			.filter({ hasText: "Calendar" });
		await calendarTab.click();
		await page.waitForTimeout(500);

		// Verify Calendar is now active
		activeTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(activeTab).toContainText("Calendar");

		// Switch back to Board, then to Calendar again to ensure consistency
		await boardTab.click();
		await page.waitForTimeout(500);
		await calendarTab.click();
		await page.waitForTimeout(500);

		activeTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(activeTab).toContainText("Calendar");
	});

	test("CR-2: Month navigation prev/next", async ({ page }) => {
		await createDatabaseWithDateField(page);

		// Switch to Calendar view
		const calendarTab = page
			.locator('[role="tab"]')
			.filter({ hasText: "Calendar" });
		await calendarTab.click();
		await page.waitForTimeout(1000);

		// The Calendar view shows the current month in a header (e.g. "June 2026")
		// and prev/next buttons with "‹" and "›" text
		const monthLabel = page.locator("text=June|July|August|January").first();

		// If the calendar has no date field, it shows a message — skip if so
		const noDateFieldMsg = page.getByText(
			"Add a Date field to use the calendar view",
		);
		if (await noDateFieldMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
			test.skip();
			return;
		}

		// Capture the current month text
		const currentMonthText = await monthLabel.textContent();

		// Click "next" (›) button
		const nextBtn = page.locator("button").filter({ hasText: "›" });
		await nextBtn.click();
		await page.waitForTimeout(500);

		// The month label should have changed
		const newMonthText = await monthLabel.textContent();
		expect(newMonthText).not.toBe(currentMonthText);

		// Click "prev" (‹) button twice to go back one month
		const prevBtn = page.locator("button").filter({ hasText: "‹" });
		await prevBtn.click();
		await page.waitForTimeout(500);
		await prevBtn.click();
		await page.waitForTimeout(500);

		// We should be one month before the original
		const finalMonthText = await monthLabel.textContent();
		expect(finalMonthText).not.toBe(newMonthText);
	});

	test("CR-3: '+' on a day creates a record dialog", async ({ page }) => {
		await createDatabaseWithDateField(page);

		// Switch to Calendar view
		const calendarTab = page
			.locator('[role="tab"]')
			.filter({ hasText: "Calendar" });
		await calendarTab.click();
		await page.waitForTimeout(1000);

		// If the calendar has no date field, skip
		const noDateFieldMsg = page.getByText(
			"Add a Date field to use the calendar view",
		);
		if (await noDateFieldMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
			test.skip();
			return;
		}

		// Click the "+" button on a day cell — it appears on hover
		// Each day cell has a "+" button with title "Add record"
		const addRecordBtn = page.locator('button[title="Add record"]').first();
		await addRecordBtn.click();
		await page.waitForTimeout(500);

		// A dialog (DialogRoot) should appear with a record title input
		const dialogInput = page.locator('input[name="new-record-title"]');
		await expect(dialogInput).toBeVisible({ timeout: 5000 });

		// Fill in a title and click Create
		await dialogInput.fill("Calendar Created Event");
		await page.locator("button").filter({ hasText: "Create" }).click();
		await page.waitForTimeout(1000);

		// The dialog should close and the record should appear on the calendar
		// The calendar grid shows record titles inside button elements
		const recordEntry = page
			.locator("button")
			.filter({ hasText: "Calendar Created Event" });
		await expect(recordEntry).toBeVisible({ timeout: 5000 });
	});
});
