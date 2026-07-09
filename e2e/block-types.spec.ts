import { test, expect } from "@playwright/test";

/**
 * Block Types via Slash Menu
 *
 * Re-written with current Tailwind-based selectors.
 * Tests assume authenticated session from auth setup.
 */

test.describe("Block Types via Slash Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-sidebar]").waitFor({ state: "visible", timeout: 15000 });
  });

  const createPage = async (page: any, name: string) => {
    await page.locator("[data-new-page]").click();
    const titleInput = page.locator('input[name="page-title"]');
    await titleInput.fill(name);
    await titleInput.press("Enter");
    await page.locator(".ProseMirror").waitFor({ state: "visible", timeout: 5000 });
  };

  const openSlashMenu = async (page: any) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.press("Home");
    await editor.press("/");
    // Wait for the slash menu to appear — it's a floating div with "Blocks" text
    await page.locator("text=Blocks").first().waitFor({ state: "visible", timeout: 3000 });
  };

  const getEditorHtml = async (page: any): Promise<string> => {
    const editor = page.locator(".ProseMirror");
    return await editor.evaluate((el: HTMLElement) => el.innerHTML);
  };

  test("slash menu shows all block types", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Block Types List ${testId}`);
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.press("Home");
    await editor.press("/");
    await page.locator("text=Blocks").first().waitFor({ state: "visible", timeout: 3000 });

    // Count visible block option buttons
    const blockButtons = page.locator("button").filter({ hasText: /^[A-Z]/ });
    const count = await blockButtons.count();
    // There should be at least 8 block types
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("insert heading via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Heading Test ${testId}`);
    await openSlashMenu(page);
    await page.locator("button").filter({ hasText: "Heading 1" }).click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("My Heading");
    await page.waitForTimeout(500);

    const html = await getEditorHtml(page);
    expect(html).toContain("<h1>");
    expect(html).toContain("My Heading");
  });

  test("insert quote via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Quote Test ${testId}`);
    await openSlashMenu(page);
    await page.locator("button").filter({ hasText: "Quote" }).click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("This is a quote");
    await page.waitForTimeout(500);

    const html = await getEditorHtml(page);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("This is a quote");
  });

  test("insert divider via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Divider Test ${testId}`);
    await openSlashMenu(page);
    await page.locator("button").filter({ hasText: "Divider" }).click();
    await page.waitForTimeout(500);

    const html = await getEditorHtml(page);
    expect(html).toContain("<hr");
  });

  test("insert todo list via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Todo Test ${testId}`);
    await openSlashMenu(page);
    await page.locator("button").filter({ hasText: "Todo List" }).click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("My task");
    await page.waitForTimeout(500);

    const html = await getEditorHtml(page);
    expect(html).toContain("My task");
  });

  test("insert toggle via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Toggle Test ${testId}`);
    await openSlashMenu(page);
    await page.locator("button").filter({ hasText: "Toggle" }).click();
    await page.waitForTimeout(500);

    const html = await getEditorHtml(page);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  test("insert code block via slash command", async ({ page }) => {
    const testId = Date.now().toString(36);
    await createPage(page, `Code Test ${testId}`);
    await openSlashMenu(page);
    await page.locator("button").filter({ hasText: "Code Block" }).click();
    await page.waitForTimeout(500);

    const editor = page.locator(".ProseMirror");
    await editor.fill("console.log('hello')");
    await page.waitForTimeout(500);

    const html = await getEditorHtml(page);
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
    await page.locator("text=Blocks").first().waitFor({ state: "visible", timeout: 3000 });

    // Type "code" to filter
    await editor.pressSequentially("code");
    await page.waitForTimeout(1500);

    // Verify Code Block is visible in filtered results
    await expect(page.locator("button").filter({ hasText: "Code Block" })).toBeVisible();
  });
});
