import { expect, test } from "@playwright/test";

/**
 * Visual regression tests for NOT-66.
 *
 * These take screenshots of key UI surfaces and compare against stored baselines.
 * CI fails when a screenshot differs above the threshold.
 *
 * Run with:   bunx playwright test --update-snapshots   to update baselines.
 * Run in CI:  bunx playwright test
 */

test.describe("Visual regression", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		try {
			await page.waitForSelector("[data-sidebar]", { timeout: 15000 });
		} catch {
			// Authenticated page not reached — test will fail informatively
		}
	});

	test("block editor with typed content", async ({ page }) => {
		// Navigate to an existing page or create one
		const newPageBtn = page.locator("[data-new-page]");
		await expect(newPageBtn).toBeVisible({ timeout: 10000 });
		await newPageBtn.click();

		const titleInput = page.locator('input[name="page-title"]');
		await expect(titleInput).toBeVisible({ timeout: 5000 });
		await titleInput.fill("Visual Regression");
		await titleInput.press("Enter");

		// Type content in the editor
		const editor = page.locator(".ProseMirror");
		await expect(editor).toBeVisible({ timeout: 5000 });
		await editor.click();
		await editor.fill(
			"This is some sample content for visual regression testing.",
		);

		// Wait for content to settle
		await page.waitForTimeout(500);

		// Take screenshot of the editor area
		await expect(page.locator("main")).toHaveScreenshot("block-editor.png", {
			maxDiffPixels: 100,
		});
	});

	test("sidebar with pages", async ({ page }) => {
		// Wait for sidebar to render
		const sidebar = page.locator("[data-sidebar]");
		await expect(sidebar).toBeVisible({ timeout: 10000 });

		// Create a couple pages so sidebar has content
		for (const title of ["Page Alpha", "Page Beta"]) {
			await page.locator("[data-new-page]").click();
			await page.locator('input[name="page-title"]').fill(title);
			await page.locator('input[name="page-title"]').press("Enter");
			await page.waitForTimeout(300);
		}

		await page.waitForTimeout(500);
		await expect(sidebar).toHaveScreenshot("sidebar-pages.png", {
			maxDiffPixels: 100,
		});
	});

	test("database table view", async ({ page }) => {
		// Create page
		await page.locator("[data-new-page]").click();
		await page.locator('input[name="page-title"]').fill("DB Table Snap");
		await page.locator('input[name="page-title"]').press("Enter");

		// Insert database via slash command
		const editor = page.locator(".ProseMirror");
		await expect(editor).toBeVisible({ timeout: 5000 });
		await editor.click();
		await editor.press("Home");
		await editor.press("/");

		const slashMenu = page
			.locator('[class*="shadow-"]')
			.filter({ hasText: "Blocks" });
		await expect(slashMenu).toBeVisible({ timeout: 3000 });
		await page.locator("button").filter({ hasText: "Database" }).click();

		// Wait for database table to render
		const dbTable = page.locator("table.w-full");
		await expect(dbTable).toBeVisible({ timeout: 10000 });
		await page.waitForTimeout(500);

		// Screenshot the database area
		const dbSection = page.locator("section").filter({ has: dbTable });
		await expect(dbSection).toHaveScreenshot("database-table-view.png", {
			maxDiffPixels: 100,
		});
	});

	test("board view", async ({ page }) => {
		// Create page
		await page.locator("[data-new-page]").click();
		await page.locator('input[name="page-title"]').fill("Board View Snap");
		await page.locator('input[name="page-title"]').press("Enter");

		// Insert database
		const editor = page.locator(".ProseMirror");
		await expect(editor).toBeVisible({ timeout: 5000 });
		await editor.click();
		await editor.press("Home");
		await editor.press("/");

		const slashMenu = page
			.locator('[class*="shadow-"]')
			.filter({ hasText: "Blocks" });
		await expect(slashMenu).toBeVisible({ timeout: 3000 });
		await page.locator("button").filter({ hasText: "Database" }).click();
		await expect(page.locator("table.w-full")).toBeVisible({ timeout: 10000 });

		// Switch to board view if tabs are available
		const boardTab = page
			.locator('button[role="tab"]')
			.filter({ hasText: /board/i });
		if (await boardTab.isVisible({ timeout: 3000 }).catch(() => false)) {
			await boardTab.click();
			await page.waitForTimeout(500);
		}

		const dbSection = page
			.locator("section")
			.filter({ has: page.locator("table.w-full") });
		await expect(dbSection).toHaveScreenshot("database-board-view.png", {
			maxDiffPixels: 100,
		});
	});
});
