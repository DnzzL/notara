import { expect, test } from "@playwright/test";
import { addField, createPage, gotoApp, insertDatabase } from "./helpers.js";

/**
 * Board View Drag-Drop
 *
 * Re-written with current Tailwind-based selectors. The board view uses
 * @dnd-kit for drag-and-drop; cards are rendered inside a grid layout with
 * CSS classes from Tailwind. No semantic class names like .board-card remain
 * after the NOT-25 Tailwind migration — we rely on role attributes, text
 * content, and structural selectors.
 *
 * These tests create a database inline via the slash menu and set up
 * a board view to test against.
 */

test.describe("Board View Drag-Drop", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the app
		await gotoApp(page);
	});

	/**
	 * @param withSelectField adds a "Status" select field, which is what the
	 * board groups by — without one it falls back to a single "All" column.
	 */
	const createDatabaseWithBoardView = async (
		page: any,
		withSelectField = false,
	) => {
		const editor = await createPage(page, "Board Test");
		await insertDatabase(page, editor);

		if (withSelectField) {
			await addField(page, "Status", "Select", ["Todo", "Done"]);
			await page.getByText("+ New record").click();
			const recordTitleInput = page
				.locator('input[name="record-title"]')
				.first();
			await expect(recordTitleInput).toBeVisible({ timeout: 10000 });
			await recordTitleInput.fill("Board Card");
			await recordTitleInput.press("Enter");
			await page.keyboard.press("Escape");
			await expect(recordTitleInput).toBeHidden({ timeout: 10000 });
		}

		// Switch to Board view by clicking the "Board" tab
		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
		await boardTab.click();
		await expect(
			page.locator('[role="tab"][aria-selected="true"]'),
		).toContainText("Board");
	};

	test("board view shows cards grouped by a select field", async ({ page }) => {
		await createDatabaseWithBoardView(page, true);

		// The board renders one column per select option, plus an "Untitled"
		// column holding records that have no value for the field yet.
		for (const column of ["Todo", "Done", "Untitled"]) {
			await expect(page.getByText(column, { exact: true }).first()).toBeVisible(
				{ timeout: 10000 },
			);
		}

		// The record with no Status lands in the ungrouped column.
		await expect(page.getByText("Board Card").first()).toBeVisible({
			timeout: 10000,
		});
	});

	test("switching between board and table views works", async ({ page }) => {
		await createDatabaseWithBoardView(page);

		// We should be on Board view
		let activeTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(activeTab).toContainText("Board");

		// Switch back to Table view
		const tableTab = page.locator('[role="tab"]').filter({ hasText: "Table" });
		await tableTab.click();
		await page.waitForTimeout(500);

		// The Table view should now be active
		activeTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(activeTab).toContainText("Table");

		// The table should be visible
		await expect(page.locator("table.w-full")).toBeVisible();

		// Switch back to Board
		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
		await boardTab.click();
		await page.waitForTimeout(500);

		activeTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(activeTab).toContainText("Board");
	});
});
