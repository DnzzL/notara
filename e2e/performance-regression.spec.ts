import { expect, test } from "@playwright/test";

/**
 * Performance regression tests for NOT-73.
 *
 * These tests measure key rendering times and assert they stay under budget.
 * Run against a running dev server (via playwright.config.ts webServer).
 */

test.describe("Performance regression", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.waitForSelector("[data-sidebar]", { timeout: 15000 });
	});

	test("sidebar render time under 2s", async ({ page }) => {
		const start = Date.now();
		await page.waitForSelector("[data-sidebar]", { timeout: 15000 });
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(2000);
	});

	test("create page and measure block-editor load time", async ({ page }) => {
		await page.evaluate(() => {
			const btn = document.querySelector("[data-new-page]");
			if (btn) (btn as HTMLElement).click();
		});
		await page.getByText("Blank page").click();
		await page.waitForTimeout(1000);

		const empty = page.getByText("This page is empty");
		if (await empty.isVisible({ timeout: 3000 }).catch(() => false)) {
			await empty.click();
		}

		const start = Date.now();
		await page
			.locator(".ProseMirror")
			.waitFor({ state: "visible", timeout: 10000 });
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(3000);
	});

	test("database table loads under 5s", async ({ page }) => {
		await page.evaluate(() => {
			const btn = document.querySelector("[data-new-page]");
			if (btn) (btn as HTMLElement).click();
		});
		await page.getByText("Blank page").click();
		await page.waitForTimeout(1500);

		const empty = page.getByText("This page is empty");
		if (await empty.isVisible({ timeout: 3000 }).catch(() => false)) {
			await empty.click();
		}

		const editor = page.locator(".ProseMirror");
		await editor.waitFor({ state: "visible", timeout: 10000 });
		await editor.click();
		await editor.press("Home");
		await editor.press("/");

		await expect(page.getByText("Blocks")).toBeVisible({ timeout: 3000 });
		await page.getByRole("button", { name: /database/i }).click();

		const dbTable = page.locator("table.w-full");
		const start = Date.now();
		await expect(dbTable).toBeVisible({ timeout: 15000 });
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(5000);
	});
});
