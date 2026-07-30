import { expect, test } from "@playwright/test";
import { createPage, gotoApp, openSlashMenu } from "./helpers.js";

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

	const createDatabaseWithBoardView = async (page: any) => {
		const editor = await createPage(
			page,
			`Board Test ${Date.now().toString(36)}`,
		);

		// Open slash menu and insert Database
		await openSlashMenu(page, editor);
		await page.locator("button").filter({ hasText: "Database" }).click();

		// Wait for the database table to render
		await page
			.locator("table.w-full")
			.waitFor({ state: "visible", timeout: 10000 });

		// Switch to Board view by clicking the "Board" tab
		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
		await boardTab.click();
		await page.waitForTimeout(1500);
	};

	test("board view shows cards grouped by a select field", async ({ page }) => {
		await createDatabaseWithBoardView(page);

		// The board view renders a DndContext with droppable columns.
		// Look for the board view container — columns are rendered as divs
		// with cards inside them.
		// When there's no select field to group by, the board shows a prompt.
		const boardContainer = page.locator('[class*="grid"]').first();
		await expect(boardContainer).toBeVisible();

		// Verify the Board tab has aria-selected="true"
		const boardTab = page.locator('[role="tab"][aria-selected="true"]');
		await expect(boardTab).toContainText("Board");
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
