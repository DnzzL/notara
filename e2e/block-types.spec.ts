import { test, expect } from "@playwright/test";

test.describe("Block Types via Slash Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".sidebar", { timeout: 10000 });
  });

  const createPage = async (page: any, name: string) => {
    await page.click("button:has-text('+ New Page')");
    const titleInput = page.locator('input[placeholder="Page title..."]');
    await titleInput.fill(name);
    await titleInput.press("Enter");
    await page.waitForSelector(".ProseMirror", { timeout: 5000 });
  };

  const openSlashMenu = async (page: any) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.press("Home");
    await editor.press("/");
    await page.waitForSelector(".slash-menu", { timeout: 3000 });
  };

  test("slash menu shows all block types", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Block Types List ${testId}`);
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.press("/");
    await page.waitForSelector(".slash-menu", { timeout: 3000 });

    // Verify all block types are present
    const items = page.locator(".slash-menu-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(12);

    // Check specific items exist
    const itemTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      itemTexts.push(await items.nth(i).textContent() || "");
    }
    const allText = itemTexts.join(" ");
    expect(allText).toContain("Heading 1");
    expect(allText).toContain("Quote");
    expect(allText).toContain("Divider");
    expect(allText).toContain("Todo List");
    expect(allText).toContain("Toggle");
    expect(allText).toContain("Image");
    expect(allText).toContain("Bullet List");
    expect(allText).toContain("Code Block");
    expect(allText).toContain("Database");
  });

  test("insert heading via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Heading Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Heading 1')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("My Heading");
    await page.waitForTimeout(500);

    const html = await editor.innerHTML();
    expect(html).toContain("<h1>My Heading</h1>");
  });

  test("insert quote via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Quote Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Quote')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("This is a quote");
    await page.waitForTimeout(500);

    const html = await editor.innerHTML();
    expect(html).toContain("<blockquote>");
    expect(html).toContain("This is a quote");
  });

  test("insert divider via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Divider Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Divider')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    const html = await editor.innerHTML();
    expect(html).toContain("<hr");
  });

  test("insert todo list via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Todo Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Todo List')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("My task");
    await page.waitForTimeout(500);

    const html = await editor.innerHTML();
    expect(html).toContain('class="task-item"');
    expect(html).toContain("My task");
  });

  test("insert toggle via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Toggle Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Toggle')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    const html = await editor.innerHTML();
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  test("insert image via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Image Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Image')");

    // The slash command triggers a hidden file input — set its files directly
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles("e2e/fixtures/test.png");
    await page.waitForTimeout(500);

    // Image should be in editor as a base64 data URL
    const editor = page.locator(".ProseMirror");
    const html = await editor.innerHTML();
    expect(html).toContain("<img");
    expect(html).toContain("data:image/png");
  });

  test("insert callout via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Callout Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Callout')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    const html = await editor.innerHTML();
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  test("insert code block via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Code Test ${testId}`);
    await openSlashMenu(page);
    await page.click(".slash-menu-item:has-text('Code Block')");
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("console.log('hello')");
    await page.waitForTimeout(500);

    const html = await editor.innerHTML();
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("console.log('hello')");
  });

  test("slash menu filters by query", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Filter Test ${testId}`);
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.press("Home");
    await editor.press("/");
    await page.waitForSelector(".slash-menu", { timeout: 3000 });

    // Type "code" to filter to Code Block
    await editor.pressSequentially("code");
    await page.waitForTimeout(1500);

    const items = page.locator(".slash-menu-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify Code Block is in the results
    const firstItem = await items.first().textContent();
    expect(firstItem).toContain("Code Block");
  });
});
