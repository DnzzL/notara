# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: basic.spec.ts >> Basic User Stories >> create a new page with title
- Location: e2e/basic.spec.ts:10:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1.page-title')
Expected substring: "My Test Page"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h1.page-title')

```

```yaml
- complementary:
  - textbox "Search pages..."
  - textbox "Page title...": My Test Page
  - navigation: No pages yet
- heading "Welcome" [level=2]
- paragraph: Select a page from the sidebar or create a new one
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | test.describe("Basic User Stories", () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto("http://localhost:5173");
  6   |     // Wait for the app to load
  7   |     await page.waitForSelector(".sidebar", { timeout: 10000 });
  8   |   });
  9   | 
  10  |   test("create a new page with title", async ({ page }) => {
  11  |     // Click New Page button
  12  |     await page.click("button:has-text('+ New Page')");
  13  |     
  14  |     // Type page title
  15  |     const titleInput = page.locator('input[placeholder="Page title..."]');
  16  |     await titleInput.fill("My Test Page");
  17  |     await titleInput.press("Enter");
  18  |     
  19  |     // Verify page title is displayed
> 20  |     await expect(page.locator("h1.page-title")).toContainText("My Test Page");
      |                                                 ^ Error: expect(locator).toContainText(expected) failed
  21  |   });
  22  | 
  23  |   test("edit page content", async ({ page }) => {
  24  |     // First create a page
  25  |     await page.click("button:has-text('+ New Page')");
  26  |     const titleInput = page.locator('input[placeholder="Page title..."]');
  27  |     await titleInput.fill("Content Test");
  28  |     await titleInput.press("Enter");
  29  |     
  30  |     // Wait for editor
  31  |     await page.waitForSelector(".ProseMirror", { timeout: 5000 });
  32  |     
  33  |     // Type in editor
  34  |     const editor = page.locator(".ProseMirror");
  35  |     await editor.fill("Hello World");
  36  |     
  37  |     // Wait for debounce save
  38  |     await page.waitForTimeout(1000);
  39  |     
  40  |     // Content should be in editor (editor state test)
  41  |     await expect(editor).toContainText("Hello World");
  42  |     
  43  |     // Note: Page reload persistence is covered by other tests
  44  |   });
  45  | 
  46  |   test("use slash command to create database", async ({ page }) => {
  47  |     // Create a page first
  48  |     await page.click("button:has-text('+ New Page')");
  49  |     const titleInput = page.locator('input[placeholder="Page title..."]');
  50  |     await titleInput.fill("Database Test");
  51  |     await titleInput.press("Enter");
  52  |     
  53  |     // Wait for editor
  54  |     await page.waitForSelector(".ProseMirror", { timeout: 5000 });
  55  |     
  56  |     // Type slash to open menu
  57  |     const editor = page.locator(".ProseMirror");
  58  |     await editor.fill("/");
  59  |     
  60  |     // Wait for slash menu
  61  |     await page.waitForSelector(".slash-menu", { timeout: 2000 });
  62  |     
  63  |     // Click Database option
  64  |     await page.click(".slash-menu-item:has-text('Database')");
  65  |     
  66  |     // Wait for database to appear
  67  |     await page.waitForSelector(".table-view", { timeout: 5000 });
  68  |     
  69  |     // Verify database is visible
  70  |     await expect(page.locator(".table-view")).toBeVisible();
  71  |   });
  72  | 
  73  |   test("add database field and record", async ({ page }) => {
  74  |     // Create page and database
  75  |     await page.click("button:has-text('+ New Page')");
  76  |     await page.locator('input[placeholder="Page title..."]').fill("DB Operations Test");
  77  |     await page.locator('input[placeholder="Page title..."]').press("Enter");
  78  |     
  79  |     await page.waitForSelector(".ProseMirror", { timeout: 5000 });
  80  |     await page.locator(".ProseMirror").fill("/");
  81  |     await page.waitForSelector(".slash-menu", { timeout: 2000 });
  82  |     await page.click(".slash-menu-item:has-text('Database')");
  83  |     await page.waitForSelector(".table-view", { timeout: 5000 });
  84  |     
  85  |     // Add a field
  86  |     await page.click('button[title="Add field"]');
  87  |     await page.locator('input[placeholder="Field name"]').fill("Status");
  88  |     await page.locator('input[placeholder="Field name"]').blur();
  89  |     
  90  |     // Add a record
  91  |     await page.locator('input[placeholder="New record..."]').fill("First Record");
  92  |     await page.locator('input[placeholder="New record..."]').press("Enter");
  93  |     
  94  |     // Verify record appears (first data row, not the add-row)
  95  |     await expect(page.locator(".table-view tbody tr:not(.add-row)")).toContainText("First Record");
  96  |   });
  97  | 
  98  |   test("edit page title", async ({ page }) => {
  99  |     // Create page
  100 |     await page.click("button:has-text('+ New Page')");
  101 |     await page.locator('input[placeholder="Page title..."]').fill("Old Title");
  102 |     await page.locator('input[placeholder="Page title..."]').press("Enter");
  103 |     
  104 |     // Click title to edit
  105 |     await page.click("h1.page-title");
  106 |     
  107 |     // Type new title
  108 |     const titleInput = page.locator(".page-title-input");
  109 |     await titleInput.fill("New Title");
  110 |     await titleInput.press("Enter");
  111 |     
  112 |     // Verify new title
  113 |     await expect(page.locator("h1.page-title")).toContainText("New Title");
  114 |   });
  115 | });
  116 | 
```