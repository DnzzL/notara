import { test, expect } from "@playwright/test";

// Clean up test results after running
test.afterAll(async () => {
  // Clean up any created test data via API if needed
  // For now, tests use unique names to avoid conflicts
});

test.describe("slash command", () => {
  test("click selection creates block", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".sidebar", { timeout: 10000 });

    // Create a page with unique name
    const testId = Date.now().toString(36);
    await page.click("button:has-text('+ New Page')");
    const titleInput = page.locator('input[placeholder="Page title..."]');
    await titleInput.fill(`Slash Click ${testId}`);
    await titleInput.press("Enter");

    // Wait for editor
    await page.waitForSelector(".ProseMirror", { timeout: 5000 });
    const editor = page.locator(".ProseMirror");

    // Click in editor and go to new line
    await editor.click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.press("/");

    // Wait for menu
    await page.waitForSelector(".slash-menu", { timeout: 3000 });

    // Click Heading 1
    await page.click(".slash-menu-item:has-text('Heading 1')");
    await page.waitForTimeout(500);

    // Check result - should have heading without the "/"
    const html = await editor.innerHTML();
    console.log("After click HTML:", html);
    expect(html).toContain("<h1>");
    expect(html).not.toContain("/<h1>"); // No slash in heading
  });

  test("enter selection creates block", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".sidebar", { timeout: 10000 });

    // Create a page with unique name
    const testId = Date.now().toString(36);
    await page.click("button:has-text('+ New Page')");
    const titleInput = page.locator('input[placeholder="Page title..."]');
    await titleInput.fill(`Slash Enter ${testId}`);
    await titleInput.press("Enter");

    // Wait for editor
    await page.waitForSelector(".ProseMirror", { timeout: 5000 });
    const editor = page.locator(".ProseMirror");

    // Click in editor and go to new line
    await editor.click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.press("/");

    // Wait for menu
    await page.waitForSelector(".slash-menu", { timeout: 3000 });

    // Press Enter to select first item (Heading 1)
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Check result - should have heading without the "/"
    const html = await editor.innerHTML();
    console.log("After enter HTML:", html);
    expect(html).toContain("<h1>");
    expect(html).not.toContain("/<h1>"); // No slash in heading
  });
});
