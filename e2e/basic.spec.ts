import { test, expect } from "@playwright/test";

test.describe("Basic User Stories", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
    // Wait for the app to load
    await page.waitForSelector(".sidebar", { timeout: 10000 });
  });

  test("create a new page with title", async ({ page }) => {
    // Click New Page button
    await page.click("button:has-text('+ New Page')");
    
    // Type page title
    const titleInput = page.locator('input[placeholder="Page title..."]');
    await titleInput.fill("My Test Page");
    await titleInput.press("Enter");
    
    // Verify page title is displayed
    await expect(page.locator("h1.page-title")).toContainText("My Test Page");
  });

  test("edit page content", async ({ page }) => {
    // First create a page
    await page.click("button:has-text('+ New Page')");
    const titleInput = page.locator('input[placeholder="Page title..."]');
    await titleInput.fill("Content Test");
    await titleInput.press("Enter");
    
    // Wait for editor
    await page.waitForSelector(".ProseMirror", { timeout: 5000 });
    
    // Type in editor
    const editor = page.locator(".ProseMirror");
    await editor.fill("Hello World");
    
    // Wait for debounce save
    await page.waitForTimeout(1000);
    
    // Content should be in editor (editor state test)
    await expect(editor).toContainText("Hello World");
    
    // Note: Page reload persistence is covered by other tests
  });

  test("use slash command to create database", async ({ page }) => {
    // Create a page first
    await page.click("button:has-text('+ New Page')");
    const titleInput = page.locator('input[placeholder="Page title..."]');
    await titleInput.fill("Database Test");
    await titleInput.press("Enter");
    
    // Wait for editor
    await page.waitForSelector(".ProseMirror", { timeout: 5000 });
    
    // Type slash to open menu
    const editor = page.locator(".ProseMirror");
    await editor.fill("/");
    
    // Wait for slash menu
    await page.waitForSelector(".slash-menu", { timeout: 2000 });
    
    // Click Database option
    await page.click(".slash-menu-item:has-text('Database')");
    
    // Wait for database to appear
    await page.waitForSelector(".table-view", { timeout: 5000 });
    
    // Verify database is visible
    await expect(page.locator(".table-view")).toBeVisible();
  });

  test("add database field and record", async ({ page }) => {
    // Create page and database
    await page.click("button:has-text('+ New Page')");
    await page.locator('input[placeholder="Page title..."]').fill("DB Operations Test");
    await page.locator('input[placeholder="Page title..."]').press("Enter");
    
    await page.waitForSelector(".ProseMirror", { timeout: 5000 });
    await page.locator(".ProseMirror").fill("/");
    await page.waitForSelector(".slash-menu", { timeout: 2000 });
    await page.click(".slash-menu-item:has-text('Database')");
    await page.waitForSelector(".table-view", { timeout: 5000 });
    
    // Add a field
    await page.click('button[title="Add field"]');
    await page.locator('input[placeholder="Field name"]').fill("Status");
    await page.locator('input[placeholder="Field name"]').blur();
    
    // Add a record
    await page.locator('input[placeholder="New record..."]').fill("First Record");
    await page.locator('input[placeholder="New record..."]').press("Enter");
    
    // Verify record appears (first data row, not the add-row)
    await expect(page.locator(".table-view tbody tr:not(.add-row)")).toContainText("First Record");
  });

  test("edit page title", async ({ page }) => {
    // Create page
    await page.click("button:has-text('+ New Page')");
    await page.locator('input[placeholder="Page title..."]').fill("Old Title");
    await page.locator('input[placeholder="Page title..."]').press("Enter");
    
    // Click title to edit
    await page.click("h1.page-title");
    
    // Type new title
    const titleInput = page.locator(".page-title-input");
    await titleInput.fill("New Title");
    await titleInput.press("Enter");
    
    // Verify new title
    await expect(page.locator("h1.page-title")).toContainText("New Title");
  });
});
