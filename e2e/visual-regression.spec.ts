import { expect, test } from "@playwright/test";
import {
	createBlankPage,
	ensureEditor,
	insertDatabase,
	setPageTitle,
} from "./helpers.js";

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
 * Stabilise the page for screenshot: hide caret + wait for animations.
 *
 * Database blocks load their rows after the editor first paints, which changes
 * the element's height mid-capture (254px -> 263px was a real failure). Waiting
 * for the box to stop moving is what makes these snapshots reproducible.
 */
async function stabiliseForScreenshot(page: any, locator = ".editor") {
	await page.addStyleTag({
		content: `* { caret-color: transparent !important; }`,
	});
	// Not networkidle: the app holds a live-collab websocket open, so it never
	// fires. Poll the bounding box until it is identical twice in a row instead.
	let previous = "";
	await expect
		.poll(
			async () => {
				const box = await page.locator(locator).first().boundingBox();
				const current = JSON.stringify(box);
				const settled = current === previous;
				previous = current;
				return settled;
			},
			{ timeout: 10000, intervals: [250] },
		)
		.toBe(true);
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

		await stabiliseForScreenshot(page, "[data-sidebar]");
		await expect(sidebar).toHaveScreenshot("sidebar-pages.png", {
			maxDiffPixels: 5000,
			animations: "disabled",
		});
	});

	test("database table view", async ({ page }) => {
		await createBlankPage(page);
		await setPageTitle(page, "DB Table Snap");

		// insertDatabase scopes the command to [data-slash-menu]; an unscoped
		// /database/i button match also hits sidebar pages named "Database …"
		// once earlier specs have created them.
		const editor = await ensureEditor(page);
		await insertDatabase(page, editor);

		// Scoped to the database block, not .editor: the editor's height varies
		// with how many blocks the page happens to have, which made the snapshot
		// depend on run order (254px vs 263px).
		await stabiliseForScreenshot(page, "[data-database-view]");
		await expect(page.locator("[data-database-view]")).toHaveScreenshot(
			"database-table-view.png",
			{ maxDiffPixels: 100, animations: "disabled" },
		);
	});

	test("board view", async ({ page }) => {
		await createBlankPage(page);
		await setPageTitle(page, "Board View Snap");

		const editor = await ensureEditor(page);
		await insertDatabase(page, editor);

		// Switch to board view. Asserted rather than guarded — a silent skip here
		// would snapshot the table view under the board's baseline name.
		await page.getByRole("tab").filter({ hasText: /board/i }).click();
		await expect(
			page.locator('[role="tab"][aria-selected="true"]'),
		).toContainText("Board");

		await stabiliseForScreenshot(page, "[data-database-view]");
		await expect(page.locator("[data-database-view]")).toHaveScreenshot(
			"database-board-view.png",
			{ maxDiffPixels: 100, animations: "disabled" },
		);
	});
});
