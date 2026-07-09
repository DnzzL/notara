import { test, expect } from "@playwright/test";

/**
 * Basic User Stories
 *
 * Re-written with current Tailwind-based selectors and workspace-routed navigation.
 * These tests assume the auth setup has provided an authenticated session.
 */

test.describe("Basic User Stories", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app — authenticated users land on their workspace
    await page.goto("/");
    // The app may redirect through /workspaces to /{workspaceSlug}
    // or land directly on a workspace page
    try {
      await page.waitForSelector("[data-sidebar]", { timeout: 15000 });
    } catch {
      // If we're not authenticated, skip — the test will fail informatively
    }
  });

  test("create a new page with title", async ({ page }) => {
    // Click New Page button
    const newPageBtn = page.locator("[data-new-page]");
    await expect(newPageBtn).toBeVisible({ timeout: 10000 });
    await newPageBtn.click();

    // Type page title in the inline editor
    const titleInput = page.locator('input[name="page-title"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill("My Test Page");
    await titleInput.press("Enter");

    // Verify the page title is displayed (h1 with the title)
    const h1 = page.locator("h1");
    await expect(h1).toContainText("My Test Page");
  });

  test("edit page content", async ({ page }) => {
    // Create a page first
    await page.locator("[data-new-page]").click();
    const titleInput = page.locator('input[name="page-title"]');
    await titleInput.fill("Content Test");
    await titleInput.press("Enter");

    // Wait for the ProseMirror editor
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type in editor
    await editor.click();
    await editor.fill("Hello World");

    // Wait for debounced save
    await page.waitForTimeout(1000);

    // Verify content persisted
    await expect(editor).toContainText("Hello World");
  });

  test("use slash command to create database", async ({ page }) => {
    // Create a page first
    await page.locator("[data-new-page]").click();
    const titleInput = page.locator('input[name="page-title"]');
    await titleInput.fill("Database Test");
    await titleInput.press("Enter");

    // Wait for editor
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Click in editor and type slash
    await editor.click();
    await editor.press("Home");
    await editor.press("/");

    // The slash menu should appear — look for a visible floating panel
    // containing "Database" option. The menu uses Tailwind classes, so
    // we target by role or text content.
    const slashMenu = page.locator('[class*="shadow-"]').filter({ hasText: "Blocks" });
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // Click "Database" option in the slash menu
    await page.locator("button").filter({ hasText: "Database" }).click();

    // Wait for the database to render — it creates a table
    // The database view renders a <table> with full-width classes
    const dbTable = page.locator("table.w-full");
    await expect(dbTable).toBeVisible({ timeout: 10000 });

    // Verify database toolbar is present (view switcher + tabs)
    const viewTabs = page.locator('[role="tablist"]');
    await expect(viewTabs).toBeVisible();
  });

  test("add database field and record", async ({ page }) => {
    // Create page and database
    await page.locator("[data-new-page]").click();
    await page.locator('input[name="page-title"]').fill("DB Operations Test");
    await page.locator('input[name="page-title"]').press("Enter");

    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await editor.press("Home");
    await editor.press("/");

    // Wait for slash menu
    const slashMenu = page.locator('[class*="shadow-"]').filter({ hasText: "Blocks" });
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // Click Database
    await page.locator("button").filter({ hasText: "Database" }).click();
    await page.locator("table.w-full").toBeVisible({ timeout: 10000 });

    // Click the "+" add-field button (in the table header)
    const addFieldBtn = page.locator('button[title="Add property"]');
    await expect(addFieldBtn).toBeVisible({ timeout: 5000 });
    await addFieldBtn.click();

    // The AddFieldPopover should appear — fill field name
    const fieldInput = page.locator('input[placeholder="Field name"]');
    if (await fieldInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fieldInput.fill("Status");
      await fieldInput.blur();
    }

    // Add a record via the "+ New record" button
    const newRecordBtn = page.getByText("+ New record");
    await expect(newRecordBtn).toBeVisible();
    await newRecordBtn.click();

    // Wait for record panel or new row to appear
    // The record panel opens with an input for the title
    const recordTitleInput = page.locator('input[name="record-title"]');
    if (await recordTitleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await recordTitleInput.fill("First Record");
      await recordTitleInput.press("Enter");
    }

    // Verify a record row exists with the title
    // The table body has rows with record data
    await expect(page.locator("table tbody")).toContainText("First Record", { timeout: 5000 });
  });
});
