# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: basic.spec.ts >> Basic User Stories >> edit page title
- Location: e2e/basic.spec.ts:103:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('.sidebar') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - navigation [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]:
            - img [ref=e8]
            - generic [ref=e13]: Notara
          - generic [ref=e14]:
            - link "Features" [ref=e15] [cursor=pointer]:
              - /url: "#features"
            - link "Pricing" [ref=e16] [cursor=pointer]:
              - /url: "#pricing"
            - link "API docs" [ref=e17] [cursor=pointer]:
              - /url: /api/docs
            - link "Sign in" [ref=e18] [cursor=pointer]:
              - /url: /login
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Open source · Self-hostable · MIT license
          - heading "The notes app you actually own" [level=1] [ref=e22]:
            - text: The notes app
            - text: you actually own
          - paragraph [ref=e23]: Notara is a local-first Notion alternative. Block editor, inline databases, and lightweight team collaboration — all in a single file on your own server.
          - generic [ref=e24]:
            - link "Get started free" [ref=e25] [cursor=pointer]:
              - /url: /login
            - link "See features" [ref=e26] [cursor=pointer]:
              - /url: "#features"
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]: Getting started
            - generic [ref=e36]: Projects
            - generic [ref=e37]: Meeting notes
            - generic [ref=e38]: Ideas
          - generic [ref=e39]:
            - generic [ref=e40]: Getting started
            - generic [ref=e41]: Welcome to Notara
            - generic [ref=e42]: Everything you write lives in a single SQLite file.
            - generic [ref=e43]: Import your Notion export
            - generic [ref=e45]:
              - generic [ref=e46]: ✓
              - text: Create your first workspace
      - generic [ref=e48]:
        - heading "Everything you need, nothing you don't" [level=2] [ref=e49]
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]: ◻
            - heading "Block editor" [level=3] [ref=e53]
            - paragraph [ref=e54]: Paragraphs, headings, todos, code, tables, toggles and more — everything you need to write clearly.
          - generic [ref=e55]:
            - generic [ref=e56]: ⊞
            - heading "Inline databases" [level=3] [ref=e57]
            - paragraph [ref=e58]: Table and board views live right inside your pages. Filter, sort, relate — no extra app required.
          - generic [ref=e59]:
            - generic [ref=e60]: ⌘
            - heading "Local-first" [level=3] [ref=e61]
            - paragraph [ref=e62]: All data stays in a single SQLite file on your server. Own your data. No vendor lock-in.
          - generic [ref=e63]:
            - generic [ref=e64]: ⚑
            - heading "Work with your team" [level=3] [ref=e65]
            - paragraph [ref=e66]: Invite teammates, see who's on the page, and edit alongside them without stepping on each other's work.
          - generic [ref=e67]:
            - generic [ref=e68]: ↓
            - heading "Import from Notion" [level=3] [ref=e69]
            - paragraph [ref=e70]: Bring your existing notes and databases in one click. Export back out anytime.
          - generic [ref=e71]:
            - generic [ref=e72]: ☁
            - heading "S3 backups" [level=3] [ref=e73]
            - paragraph [ref=e74]: Optional encrypted backups to any S3-compatible bucket. Scheduled or manual.
          - generic [ref=e75]:
            - generic [ref=e76]: ⌁
            - heading "Open REST API" [level=3] [ref=e77]
            - paragraph [ref=e78]: Full HTTP API with API key auth. Automate from scripts, CI pipelines, or any HTTP client. OpenAPI spec included.
            - link "View API docs →" [ref=e79] [cursor=pointer]:
              - /url: /api/docs
      - generic [ref=e81]:
        - heading "Simple pricing" [level=2] [ref=e82]
        - paragraph [ref=e83]: Host it yourself for free, or let us handle it when cloud launches.
        - generic [ref=e84]:
          - generic [ref=e85]:
            - generic [ref=e86]: Self-hosted
            - generic [ref=e87]:
              - text: Free
              - generic [ref=e88]: / forever
            - list [ref=e89]:
              - listitem [ref=e90]:
                - generic [ref=e91]: ✓
                - text: Unlimited pages & blocks
              - listitem [ref=e92]:
                - generic [ref=e93]: ✓
                - text: Unlimited workspaces
              - listitem [ref=e94]:
                - generic [ref=e95]: ✓
                - text: Invite-based team access
              - listitem [ref=e96]:
                - generic [ref=e97]: ✓
                - text: S3 backup support
              - listitem [ref=e98]:
                - generic [ref=e99]: ✓
                - text: MIT licensed
            - link "Deploy yourself" [ref=e100] [cursor=pointer]:
              - /url: https://github.com
          - generic [ref=e101]:
            - generic [ref=e102]: Cloud
            - generic [ref=e103]: Coming soon
            - list [ref=e104]:
              - listitem [ref=e105]:
                - generic [ref=e106]: ✓
                - text: Everything in Self-hosted
              - listitem [ref=e107]:
                - generic [ref=e108]: ✓
                - text: Hosted & managed for you
              - listitem [ref=e109]:
                - generic [ref=e110]: ✓
                - text: Automatic updates
              - listitem [ref=e111]:
                - generic [ref=e112]: ✓
                - text: Priority support
            - link "Get notified" [ref=e113] [cursor=pointer]:
              - /url: /login
      - contentinfo [ref=e114]:
        - generic [ref=e115]:
          - generic [ref=e116]: © 2025 Notara. MIT licensed.
          - generic [ref=e117]:
            - link "GitHub" [ref=e118] [cursor=pointer]:
              - /url: https://github.com
            - link "API docs" [ref=e119] [cursor=pointer]:
              - /url: /api/docs
            - link "Sign in" [ref=e120] [cursor=pointer]:
              - /url: /login
    - generic:
      - contentinfo:
        - button "Open TanStack Router Devtools" [ref=e121] [cursor=pointer]:
          - generic [ref=e122]:
            - img [ref=e124]
            - img [ref=e159]
          - generic [ref=e193]: "-"
          - generic [ref=e194]: TanStack Router
  - region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | test.describe("Basic User Stories", () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto("http://localhost:5173");
  6   |     // Wait for the app to load
> 7   |     await page.waitForSelector(".sidebar", { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
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
  20  |     await expect(page.locator("h1.page-title")).toContainText("My Test Page");
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
  56  |     // Click in editor and type slash at start of line
  57  |     const editor = page.locator(".ProseMirror");
  58  |     await editor.click();
  59  |     await editor.press("Home"); // Go to start of line
  60  |     await editor.press("/");
  61  |     
  62  |     // Wait for slash menu
  63  |     await page.waitForSelector(".slash-menu", { timeout: 2000 });
  64  |     
  65  |     // Click Database option
  66  |     await page.click(".slash-menu-item:has-text('Database')");
  67  |     
  68  |     // Wait for database to appear
  69  |     await page.waitForSelector(".table-view", { timeout: 5000 });
  70  |     
  71  |     // Verify database is visible
  72  |     await expect(page.locator(".table-view")).toBeVisible();
  73  |   });
  74  | 
  75  |   test("add database field and record", async ({ page }) => {
  76  |     // Create page and database
  77  |     await page.click("button:has-text('+ New Page')");
  78  |     await page.locator('input[placeholder="Page title..."]').fill("DB Operations Test");
  79  |     await page.locator('input[placeholder="Page title..."]').press("Enter");
  80  |     
  81  |     await page.waitForSelector(".ProseMirror", { timeout: 5000 });
  82  |     const editor = page.locator(".ProseMirror");
  83  |     await editor.click();
  84  |     await editor.press("Home");
  85  |     await editor.press("/");
  86  |     await page.waitForSelector(".slash-menu", { timeout: 2000 });
  87  |     await page.click(".slash-menu-item:has-text('Database')");
  88  |     await page.waitForSelector(".table-view", { timeout: 5000 });
  89  |     
  90  |     // Add a field
  91  |     await page.click('button[title="Add field"]');
  92  |     await page.locator('input[placeholder="Field name"]').fill("Status");
  93  |     await page.locator('input[placeholder="Field name"]').blur();
  94  |     
  95  |     // Add a record
  96  |     await page.locator('input[placeholder="New record..."]').fill("First Record");
  97  |     await page.locator('input[placeholder="New record..."]').press("Enter");
  98  |     
  99  |     // Verify record appears (first data row, not the add-row)
  100 |     await expect(page.locator(".table-view tbody tr:not(.add-row)")).toContainText("First Record");
  101 |   });
  102 | 
  103 |   test("edit page title", async ({ page }) => {
  104 |     // Create page
  105 |     await page.click("button:has-text('+ New Page')");
  106 |     await page.locator('input[placeholder="Page title..."]').fill("Old Title");
  107 |     await page.locator('input[placeholder="Page title..."]').press("Enter");
```