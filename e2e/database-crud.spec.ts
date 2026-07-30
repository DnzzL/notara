import { expect, test } from "@playwright/test";
import { addField, createPage, gotoApp, insertDatabase } from "./helpers.js";

/**
 * Database CRUD Operations
 *
 * Tests the core data persistence loop for all field types and the cell
 * editing UI — the areas most likely to have state-management bugs (stale
 * closures, blur/Enter races, JSON serialization issues).
 *
 * Each test creates a fresh database page, adds fields and records, then
 * exercises inline cell editing and verifies the values persisted.
 */

test.describe("Database CRUD", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	// ── Helpers ────────────────────────────────────────────────────────────

	/**
	 * Create a page with a database table and a record.
	 * Returns a locator for the first data row (tbody tr).
	 */
	async function createDbWithRecord(page: any) {
		const editor = await createPage(page, "DB CRUD Test");
		await insertDatabase(page, editor);
		await expect(page.locator('button[title="Add property"]')).toBeVisible({
			timeout: 10000,
		});

		// Create a record via the "+ New record" button
		await page.getByText("+ New record").click();

		// The RecordPanel drawer opens. Set the title.
		const titleInput = page.locator('input[name="record-title"]').first();
		await expect(titleInput).toBeVisible({ timeout: 5000 });
		await titleInput.fill("My Record");
		await titleInput.press("Enter");

		// Close the drawer so cell clicks aren't intercepted
		await page.keyboard.press("Escape");
		await expect(titleInput).toBeHidden({ timeout: 5000 });

		// Verify the record row is in the table
		const row = page.locator("table tbody tr").first();
		await expect(row).toContainText("My Record", { timeout: 5000 });
		return row;
	}

	/**
	 * Find the nth field cell (0-indexed, skipping the title column) in a row.
	 * Notes field is at index 0, Status at index 1, etc.
	 */
	function fieldCell(row: any, index: number) {
		return row.locator("td.db-cell").nth(index);
	}

	// ── Tests ─────────────────────────────────────────────────────────────

	test("DC-1: Text cell — inline edit saves and displays value", async ({
		page,
	}) => {
		const row = await createDbWithRecord(page);

		// The first field is "Notes" (text). Double-click the cell to enter
		// inline edit mode.
		const cell = fieldCell(row, 0);
		await cell.dblclick();
		await page.waitForTimeout(200);

		// A text input should appear
		const textInput = page.locator('input[name="cell-text"]');
		await expect(textInput).toBeVisible({ timeout: 3000 });

		// Type a value and press Enter to save
		await textInput.fill("Hello from test");
		await textInput.press("Enter");
		await page.waitForTimeout(300);

		// The editor should close and the value should be displayed
		await expect(textInput).toBeHidden({ timeout: 3000 });
		await expect(cell).toContainText("Hello from test");
	});

	test("DC-2: Select cell — pick an option displays pill", async ({ page }) => {
		const row = await createDbWithRecord(page);
		await addField(page, "Status", "Select", ["Open", "In Progress", "Done"]);

		// Status is the 2nd field (index 1)
		const cell = fieldCell(row, 1);

		// It should show a placeholder (empty) initially
		await expect(cell).toBeVisible();

		// Double-click to open the SelectPopover
		await cell.dblclick();
		await page.waitForTimeout(200);

		// The SelectPopover should have a search input
		const searchInput = page.locator('input[name="cell-select-search"]');
		await expect(searchInput).toBeVisible({ timeout: 3000 });

		// Pick "In Progress"
		await page.getByText("In Progress").click();
		await page.waitForTimeout(300);

		// The popover should close and the value should display as a pill
		await expect(cell.locator("span").first()).toContainText("In Progress");
	});

	test("DC-3: Select inline create — new option created and persisted", async ({
		page,
	}) => {
		const row = await createDbWithRecord(page);
		await addField(page, "Status", "Select", ["Open", "Done"]);

		const cell = fieldCell(row, 1);

		// Double-click to open SelectPopover
		await cell.dblclick();
		await page.waitForTimeout(200);

		const searchInput = page.locator('input[name="cell-select-search"]');
		await expect(searchInput).toBeVisible({ timeout: 3000 });

		// Type a new option name — the "Create" button should appear
		await searchInput.fill("In Progress");
		const createOption = page.getByText('Create "In Progress"');
		await expect(createOption).toBeVisible({ timeout: 3000 });

		// Click Create
		await createOption.click();
		await page.waitForTimeout(500);

		// The cell should show the new option as a pill
		await expect(cell).toContainText("In Progress");

		// Verify the new option persisted by opening the column header menu
		// and checking the options list via "Edit options".
		const statusHeader = page
			.locator("table thead")
			.getByText("Status", { exact: true });
		await expect(statusHeader).toBeVisible({ timeout: 3000 });

		// Click the caret trigger to open the column popover
		const statusTh = page
			.locator("table thead th")
			.filter({ hasText: "Status" })
			.first();
		await statusTh.evaluate((el: HTMLElement) => {
			const caret = el.querySelector<HTMLElement>("[data-col-menu-trigger]");
			if (caret) caret.click();
		});
		await page.waitForTimeout(300);

		// Open Edit options — this opens the OptionsEditor sub-popover
		const editOptionsBtn = page.getByText("Edit options");
		await expect(editOptionsBtn).toBeVisible({ timeout: 3000 });
		await editOptionsBtn.click();
		await page.waitForTimeout(300);

		// The OptionsEditor should contain "In Progress" in the option list.
		// Verify the header and the three options are visible.
		await expect(page.getByText('Edit "Status" options')).toBeVisible({
			timeout: 3000,
		});
		await expect(page.getByText("Open")).toBeVisible({ timeout: 3000 });
		await expect(page.getByText("Done")).toBeVisible({ timeout: 3000 });
		await expect(page.getByText("In Progress").first()).toBeVisible({
			timeout: 3000,
		});
	});

	test("DC-4: Multi-select — toggle multiple options shows pills", async ({
		page,
	}) => {
		const row = await createDbWithRecord(page);
		await addField(page, "Tags", "Multi-select", [
			"Urgent",
			"Bug",
			"Feature",
			"Docs",
		]);

		const cell = fieldCell(row, 1);

		// Each option toggle in SelectPopover saves immediately and closes the
		// popover (handleCellEdit closes the editor). Re-open for each toggle.

		// Toggle "Urgent"
		await cell.dblclick();
		await page.waitForTimeout(200);
		await page.getByText("Urgent").click();
		await page.waitForTimeout(300);

		// Toggle "Bug"
		await cell.dblclick();
		await page.waitForTimeout(200);
		await page.getByText("Bug").click();
		await page.waitForTimeout(300);

		// Both pills should be visible in the cell
		await expect(cell).toContainText("Urgent");
		await expect(cell).toContainText("Bug");
	});

	test("DC-5: Number cell — inline edit saves formatted value", async ({
		page,
	}) => {
		const row = await createDbWithRecord(page);
		await addField(page, "Score", "Number");

		const cell = fieldCell(row, 1);

		// Double-click to edit
		await cell.dblclick();
		await page.waitForTimeout(200);

		const numberInput = page.locator('input[name="cell-number"]');
		await expect(numberInput).toBeVisible({ timeout: 3000 });

		// Type a number and save
		await numberInput.fill("42");
		await numberInput.press("Enter");
		await page.waitForTimeout(300);

		// The editor closes and the formatted value appears
		await expect(numberInput).toBeHidden({ timeout: 3000 });
		await expect(cell).toContainText("42");
	});

	test("DC-6: Formula — computes value from another field", async ({
		page,
	}) => {
		const row = await createDbWithRecord(page);

		// Add a Number field, then a Formula field that references it
		await addField(page, "Quantity", "Number");
		await addField(page, "Double", "Formula");

		// The Formula field needs a formula expression. Open the column header
		// menu and click "Edit formula" to set it. Double is the 3rd field (idx 2).
		const doubleHeader = page
			.locator("table thead")
			.getByText("Double", { exact: true });
		await expect(doubleHeader).toBeVisible({ timeout: 5000 });

		// Click the menu trigger caret to open the column popover
		const doubleTh = page
			.locator("table thead th")
			.filter({ hasText: "Double" })
			.first();
		await doubleTh.evaluate((el: HTMLElement) => {
			const caret = el.querySelector<HTMLElement>("[data-col-menu-trigger]");
			if (caret) caret.click();
		});
		await page.waitForTimeout(300);

		// Click "Edit formula"
		const editFormulaBtn = page.getByText("Edit formula");
		await expect(editFormulaBtn).toBeVisible({ timeout: 3000 });
		await editFormulaBtn.click();
		await page.waitForTimeout(300);

		// The FormulaEditor popover appears — type the formula
		const formulaTextarea = page.locator('textarea[name="formula"]');
		await expect(formulaTextarea).toBeVisible({ timeout: 3000 });
		await formulaTextarea.fill(`prop("Quantity") * 2`);

		// Click Save
		await page.getByRole("button", { name: "Save" }).click();
		await page.waitForTimeout(500);

		// Now edit the Quantity cell (field index 1) to set a value
		const qtyCell = fieldCell(row, 1);
		await qtyCell.click();
		await qtyCell.click();
		await page.waitForTimeout(200);

		const qtyInput = page.locator('input[name="cell-number"]');
		await expect(qtyInput).toBeVisible({ timeout: 3000 });
		await qtyInput.fill("21");
		await qtyInput.press("Enter");
		await page.waitForTimeout(500);

		// The Double formula cell (field index 2) should show 42
		const formulaCell = fieldCell(row, 2);
		await expect(formulaCell).toContainText("42", { timeout: 5000 });
	});

	test("DC-7: Record deletion — Delete button removes row from table", async ({
		page,
	}) => {
		const row = await createDbWithRecord(page);

		// The delete button is in the first column (drag handle col).
		// It has opacity:0 until hover, so we use force-click via evaluate.
		// It's titled "Delete record".
		const deleteBtn = row.locator('button[title="Delete record"]');

		await deleteBtn.evaluate((el: HTMLElement) => el.click());
		await page.waitForTimeout(500);

		// The record should be removed — check that the title text is gone
		await expect(
			page.locator("table tbody").getByText("My Record"),
		).not.toBeVisible({ timeout: 5000 });
	});
});
