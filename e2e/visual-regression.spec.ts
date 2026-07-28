import { expect, test } from "@playwright/test";

/**
 * Visual regression tests for NOT-66.
 *
 * These take screenshots of key UI surfaces and compare against stored baselines.
 * CI fails when a screenshot differs above the threshold.
 *
 * Run with:   bunx playwright test --update-snapshots   to update baselines.
 * Run in CI:  bunx playwright test
 *
 * NOTE: The app has overlays that intercept pointer events. We use
 * page.evaluate() to click through them or interact with them directly.
 * Cookie consent is dismissed in auth setup, and the onboarding tour is
 * marked as completed via localStorage.
 */

/**
 * Click [data-new-page], then select "Blank page" from the template picker.
 */
async function createBlankPage(page: any) {
	await page.evaluate(() => {
		const btn = document.querySelector("[data-new-page]");
		if (btn) (btn as HTMLElement).click();
	});
	const blankPage = page.getByText("Blank page");
	await expect(blankPage).toBeVisible({ timeout: 5000 });
	await blankPage.click();
	await page.waitForTimeout(1000);
}

/**
 * Set the page title. The title renders as an h1; clicking it shows an input.
 */
async function setPageTitle(page: any, title: string) {
	await page.evaluate(() => {
		const h1 = document.querySelector("h1");
		if (h1) (h1 as HTMLElement).click();
	});
	const input = page.locator('input[name="page-title"]');
	await expect(input).toBeVisible({ timeout: 5000 });
	await input.fill(title);
	await input.press("Enter");
}

/**
 * Ensure the page has at least one block (click "This page is empty" if needed).
 */
async function ensureEditor(page: any) {
	const emptyState = page.getByText("This page is empty");
	if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
		await emptyState.click();
	}
	const editor = page.locator(".ProseMirror");
	await editor.waitFor({ state: "attached", timeout: 10000 });
	return editor;
}

/**
 * Stabilise the page for screenshot: hide caret + wait for animations.
 */
async function stabiliseForScreenshot(page: any) {
	await page.addStyleTag({
		content: `* { caret-color: transparent !important; }`,
	});
	await page.waitForTimeout(500);
}

test.describe("Visual regression", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.waitForSelector("h1", { timeout: 15000 });
		try {
			await page.waitForSelector("[data-sidebar]", { timeout: 10000 });
		} catch {
			// Authenticated page not reached
		}
	});

	test("block editor with typed content", async ({ page }) => {
		await createBlankPage(page);
		await setPageTitle(page, "Visual Regression");

		const editor = await ensureEditor(page);
		await page.evaluate(() => {
			const el = document.querySelector(".ProseMirror");
			if (el) (el as HTMLElement).focus();
		});
		await editor.fill(
			"This is some sample content for visual regression testing.",
		);

		await stabiliseForScreenshot(page);
		await expect(page.locator(".editor")).toHaveScreenshot("block-editor.png", {
			maxDiffPixels: 100,
			animations: "disabled",
			timeout: 15000,
		});
	});

	test("sidebar with pages", async ({ page }) => {
		const sidebar = page.locator("[data-sidebar]");
		await expect(sidebar).toBeVisible({ timeout: 10000 });

		for (const title of ["Page Alpha", "Page Beta"]) {
			await createBlankPage(page);
			await setPageTitle(page, title);
			await page.waitForTimeout(300);
		}

		await page.waitForTimeout(500);
		await expect(sidebar).toHaveScreenshot("sidebar-pages.png", {
			maxDiffPixels: 100,
			animations: "disabled",
		});
	});

	test("database table view", async ({ page }) => {
		await createBlankPage(page);
		await setPageTitle(page, "DB Table Snap");

		const editor = await ensureEditor(page);
		await page.evaluate(() => {
			const el = document.querySelector(".ProseMirror");
			if (el) (el as HTMLElement).focus();
		});
		await editor.press("Home");
		await editor.press("/");

		// Wait for slash command menu (has heading "Blocks")
		await expect(page.getByText("Blocks")).toBeVisible({ timeout: 3000 });
		await page.getByRole("button", { name: /database/i }).click();

		// Wait for the database table to render
		await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

		await stabiliseForScreenshot(page);
		await expect(page.locator(".editor")).toHaveScreenshot(
			"database-table-view.png",
			{ maxDiffPixels: 100, animations: "disabled" },
		);
	});

	test("board view", async ({ page }) => {
		await createBlankPage(page);
		await setPageTitle(page, "Board View Snap");

		const editor = await ensureEditor(page);
		await page.evaluate(() => {
			const el = document.querySelector(".ProseMirror");
			if (el) (el as HTMLElement).focus();
		});
		await editor.press("Home");
		await editor.press("/");

		// Wait for slash command menu (has heading "Blocks")
		await expect(page.getByText("Blocks")).toBeVisible({ timeout: 3000 });
		await page.getByRole("button", { name: /database/i }).click();
		await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

		// Switch to board view
		const boardTab = page.getByRole("tab").filter({ hasText: /board/i });
		if (await boardTab.isVisible({ timeout: 3000 }).catch(() => false)) {
			await boardTab.click();
			await page.waitForTimeout(1000);
		}

		await stabiliseForScreenshot(page);
		await expect(page.locator(".editor")).toHaveScreenshot(
			"database-board-view.png",
			{ maxDiffPixels: 100, animations: "disabled" },
		);
	});
});
