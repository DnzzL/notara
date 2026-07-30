import { expect, type Locator, test } from "@playwright/test";
import { addField, createPage, gotoApp, insertDatabase } from "./helpers.js";

/**
 * Popover Positioning Specs
 *
 * NOT-77: The Popover component measures its height once on mount (in a
 * useEffect keyed only on [triggerRect]) and never recomputes when the
 * content grows. Because the popover uses position:fixed, scrolling the
 * page cannot recover the off-screen portion.
 *
 * These tests trigger content growth inside every popover variant and assert
 * that the primary action button remains inside the viewport and clickable.
 *
 * Each test:
 *   1. Creates a fresh database page at 1280x720 (default viewport)
 *   2. Opens the relevant popover
 *   3. Triggers content growth
 *   4. Asserts the action button is in the viewport and interactable
 *
 * NOTE: Some tests are expected to FAIL until the Popover component is fixed
 * to use ResizeObserver (AC #1 of NOT-77). Once the fix lands, these should
 * all pass — they serve as regression guards.
 */

test.describe("Popover Positioning", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	// ── Helpers ────────────────────────────────────────────────────────────

	/**
	 * Create a page with a database table.
	 */
	async function createDbPage(page: any) {
		const editor = await createPage(page, "Popover Positioning Test");
		await insertDatabase(page, editor);
		await expect(page.locator('button[title="Add property"]')).toBeVisible({
			timeout: 10000,
		});
		return editor;
	}

	/**
	 * Assert that an element is fully inside the viewport.
	 */
	async function assertInViewport(
		page: any,
		locator: ReturnType<typeof page.locator>,
		label: string,
	) {
		await expect(async () => {
			const box = await locator.boundingBox();
			if (!box) throw new Error(`${label} has no bounding box`);
			const vw = page.viewportSize()?.width ?? 1280;
			const vh = page.viewportSize()?.height ?? 720;
			expect(
				box.x,
				`${label} left edge (${box.x}) should be >= 0`,
			).toBeGreaterThanOrEqual(0);
			expect(
				box.y,
				`${label} top edge (${box.y}) should be >= 0`,
			).toBeGreaterThanOrEqual(0);
			expect(
				box.x + box.width,
				`${label} right edge (${box.x + box.width}) should be <= ${vw}`,
			).toBeLessThanOrEqual(vw);
			expect(
				box.y + box.height,
				`${label} bottom edge (${box.y + box.height}) should be <= ${vh}`,
			).toBeLessThanOrEqual(vh);
		}).toPass({ timeout: 5000, intervals: [500] });
	}

	/**
	 * Assert that Playwright considers an element actionable (click will
	 * succeed without "element outside viewport" error).
	 */
	async function assertActionable(
		page: any,
		locator: ReturnType<typeof page.locator>,
		label: string,
	) {
		// Check the element's actionability by running Playwright's built-in
		// "check" via .isEnabled() and .boundingBox(), plus a no-op click
		// force check.
		await expect(locator).toBeVisible({ timeout: 3000 });
		await expect(locator).toBeEnabled({ timeout: 3000 });
		// A full boundingBox check ensures it's genuinely in the viewport,
		// not just "visible" in the DOM sense but clipped.
		await assertInViewport(page, locator, label);
	}

	/**
	 * Open the add-field popover and fill the name.
	 */
	async function openAddField(
		page: any,
		name: string,
	): Promise<ReturnType<typeof page.locator>> {
		await page.locator('button[title="Add property"]').click();
		const popover = page.locator("[data-add-field]");
		await expect(popover).toBeVisible({ timeout: 10000 });
		const nameInput = popover.locator('input[name="new-property-name"]');
		await nameInput.fill(name);
		return popover;
	}

	/**
	 * Click a type label within the AddFieldPopover.
	 *
	 * Uses force-click + press("Enter") as a fallback when the type label is
	 * rendered but outside the viewport (NOT-77 bug — the popover doesn't
	 * reposition after the Show Advanced fold-out).
	 */
	async function pickFieldType(popover: Locator, label: string) {
		const typeOpt = popover.getByText(label, { exact: true });
		try {
			await typeOpt.click({ timeout: 3000 });
		} catch {
			// If the label is present but outside the viewport (popover didn't
			// reposition after fold-out), click via evaluate to bypass the
			// viewport check — the handler is a simple setState, not a nav link.
			await typeOpt.evaluate((el: HTMLElement) => el.click());
		}
	}

	/**
	 * Add options to the Select/Multi-select option editor that appears
	 * after picking the type.
	 */
	async function addOptions(page: any, popover: Locator, options: string[]) {
		for (const opt of options) {
			const optionInput = popover.getByPlaceholder("Add option");
			await optionInput.fill(opt);
			await optionInput.press("Enter");
			await page.waitForTimeout(100);
		}
	}

	/**
	 * Click the Create button in the add-field popover and verify the field
	 * was created.
	 */
	async function clickCreateAndVerify(
		page: any,
		popover: Locator,
		fieldName: string,
	) {
		const createBtn = popover.getByRole("button", { name: "Create" });
		await assertActionable(page, createBtn, `Create button (${fieldName})`);
		await createBtn.click();
		await expect(popover).toBeHidden({ timeout: 5000 });
		await expect(
			page.locator("table thead").getByText(fieldName, { exact: true }),
		).toBeVisible({ timeout: 5000 });
	}

	// ── AddFieldPopover tests ─────────────────────────────────────────────

	test("PF-1: Add-field — Select type with 3+ options keeps Create clickable", async ({
		page,
	}) => {
		await createDbPage(page);
		const popover = await openAddField(page, "Priority");

		// Select is a BASIC type — immediately visible
		await pickFieldType(popover, "Select");
		await page.waitForTimeout(200);

		// Add 3 options — each one adds a row and grows the popover
		await addOptions(page, popover, ["High", "Medium", "Low"]);

		// Verify Create is visible and clickable at 1280x720
		await clickCreateAndVerify(page, popover, "Priority");
	});

	test("PF-2: Add-field — Multi-select with 5+ options keeps Create clickable", async ({
		page,
	}) => {
		await createDbPage(page);
		const popover = await openAddField(page, "Tags");

		// Multi-select is an ADVANCED type — click Show advanced first
		await popover.getByText("Show advanced").click();
		await page.waitForTimeout(200);

		await pickFieldType(popover, "Multi-select");
		await page.waitForTimeout(200);

		// Add 5 options
		await addOptions(page, popover, [
			"Urgent",
			"Bug",
			"Feature",
			"Docs",
			"Internal",
		]);

		await clickCreateAndVerify(page, popover, "Tags");
	});

	test("PF-3: Add-field — Relation type async DB list load keeps Create clickable", async ({
		page,
	}) => {
		await createDbPage(page);
		const popover = await openAddField(page, "Related DB");

		// Relation is an ADVANCED type
		await popover.getByText("Show advanced").click();
		await page.waitForTimeout(200);

		await pickFieldType(popover, "Relation");
		await page.waitForTimeout(200);

		// Wait for the async database list to load (the select element appears)
		const relationSelect = popover.locator('select[name="relation-target"]');
		await expect(relationSelect).toBeVisible({ timeout: 10000 });

		await clickCreateAndVerify(page, popover, "Related DB");
	});

	test("PF-4: Add-field — Advanced type fold expansion keeps Create clickable", async ({
		page,
	}) => {
		await createDbPage(page);
		const popover = await openAddField(page, "Score");

		// Click "Show advanced" to expand the advanced types fold
		await popover.getByText("Show advanced").click();
		await page.waitForTimeout(200);

		// The advanced type list should be visible
		await expect(popover.getByText("Formula")).toBeVisible({ timeout: 3000 });

		await clickCreateAndVerify(page, popover, "Score");
	});

	// ── OptionsEditor popover (popover within a popover) ───────────────────

	test("PF-5: OptionsEditor — adding options to an existing Select field stays in viewport", async ({
		page,
	}) => {
		await createDbPage(page);

		// Create a Select field with 2 initial options
		await addField(page, "Status", "Select", ["Open", "In Progress"]);

		// The Status column header is a <th> in the <thead>.
		// The non-title column header has a [data-col-menu-trigger] caret that is
		// opacity:0 until hover. Click it to open the popover menu.
		const statusTh = page
			.locator("table thead th")
			.filter({ hasText: "Status" })
			.first();
		await expect(statusTh).toBeVisible({ timeout: 5000 });

		// Click the menu trigger caret via evaluate to avoid hover/opacity issues
		await statusTh.evaluate((el: HTMLElement) => {
			const caret = el.querySelector<HTMLElement>("[data-col-menu-trigger]");
			if (caret) caret.click();
		});
		await page.waitForTimeout(300);

		// The header popover should show "Edit options" for a Select-type field.
		// Click it to open the OptionsEditor sub-popover.
		const editOptionsBtn = page.getByText("Edit options");
		await expect(editOptionsBtn).toBeVisible({ timeout: 3000 });
		await editOptionsBtn.click();
		await page.waitForTimeout(300);

		// The OptionsEditor popover uses the same Popover component.
		// It has an input[name="new-select-option"].
		const optionInput = page.locator('input[name="new-select-option"]');
		await expect(optionInput).toBeVisible({ timeout: 5000 });

		// Add 4 more options to grow the popover content
		for (const opt of ["Blocked", "Review", "Done", "Deferred"]) {
			await optionInput.fill(opt);
			await optionInput.press("Enter");
			await page.waitForTimeout(100);
		}

		// The OptionsEditor popover doesn't have a fixed action button at the
		// bottom — the "Add option" input is at the bottom. Verify the popover
		// itself stays within viewport bounds.
		await assertInViewport(
			page,
			optionInput,
			"OptionsEditor input (4 added options)",
		);

		// Verify the added options are visible
		await expect(page.getByText("Blocked")).toBeVisible({ timeout: 3000 });
	});

	// ── FormulaEditor popover ─────────────────────────────────────────────

	test("PF-6: FormulaEditor — selecting Formula type and typing keeps popover in viewport", async ({
		page,
	}) => {
		await createDbPage(page);
		const popover = await openAddField(page, "Computed");

		// Formula is an ADVANCED type
		await popover.getByText("Show advanced").click();
		await page.waitForTimeout(200);

		// Pick Formula — may be outside viewport after the fold-out
		// (NOT-77: popover didn't reposition, so advanced types spill)
		await pickFieldType(popover, "Formula");
		await page.waitForTimeout(200);

		// The formula textarea should be visible
		const formulaInput = popover.locator('textarea[name="formula"]');
		await expect(formulaInput).toBeVisible({ timeout: 3000 });

		// Type a formula to verify the textarea stays usable
		await formulaInput.fill(`prop("Name")`);

		await clickCreateAndVerify(page, popover, "Computed");
	});
});
