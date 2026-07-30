import { expect, test } from "@playwright/test";
import { addField, createPage, gotoApp, insertDatabase } from "./helpers.js";

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
		const editor = await createPage(page, "Calendar Test");
		await insertDatabase(page, editor);

		// The Calendar view only renders a month grid once a date field exists.
		await addField(page, "Event Date", "Date");

		// Add a record. "+ New record" opens the RecordPanel drawer.
		await page.getByText("+ New record").click();
		const recordTitleInput = page.locator('input[name="record-title"]').first();
		await expect(recordTitleInput).toBeVisible({ timeout: 10000 });
		await recordTitleInput.fill("Test Event");
		await recordTitleInput.press("Enter");

		// Close the drawer — it overlays the view tabs.
		await page.keyboard.press("Escape");
		await expect(recordTitleInput).toBeHidden({ timeout: 10000 });
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

		// The header renders "<Month> <year>" between the ‹ and › buttons.
		const monthLabel = page.getByText(/^[A-Z][a-z]+ \d{4}$/).first();
		await expect(monthLabel).toBeVisible({ timeout: 10000 });

		const initial = await monthLabel.textContent();
		if (!initial) throw new Error("month label empty");

		// Next moves forward a month.
		await page.getByRole("button", { name: "›" }).click();
		await expect(monthLabel).not.toHaveText(initial, { timeout: 5000 });
		const next = await monthLabel.textContent();

		// Prev twice lands one month before where we started.
		await page.getByRole("button", { name: "‹" }).click();
		await expect(monthLabel).toHaveText(initial, { timeout: 5000 });
		await page.getByRole("button", { name: "‹" }).click();

		await expect(monthLabel).not.toHaveText(initial, { timeout: 5000 });
		await expect(monthLabel).not.toHaveText(next as string);
	});

	test("CR-3: '+' on a day creates a record dialog", async ({ page }) => {
		await createDatabaseWithDateField(page);

		// Switch to Calendar view
		const calendarTab = page
			.locator('[role="tab"]')
			.filter({ hasText: "Calendar" });
		await calendarTab.click();
		await page.waitForTimeout(1000);

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
