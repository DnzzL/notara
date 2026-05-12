import { test, expect } from "@playwright/test";

test("debug slash command", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForSelector(".sidebar", { timeout: 10000 });

  // Create a page
  await page.click("button:has-text('+ New Page')");
  const titleInput = page.locator('input[placeholder="Page title..."]');
  await titleInput.fill("Slash Test");
  await titleInput.press("Enter");

  // Wait for editor
  await page.waitForSelector(".ProseMirror", { timeout: 5000 });
  const editor = page.locator(".ProseMirror");

  // Click in editor and type
  await editor.click();
  await editor.fill("Some text");
  await page.waitForTimeout(500);

  // Press Enter to go to new line, then type slash
  await editor.press("End");
  await editor.press("Enter");

  // Get HTML before
  const beforeHtml = await editor.innerHTML();
  console.log("Before slash HTML:", beforeHtml);

  // Type slash
  await editor.press("/");

  // Wait for menu
  await page.waitForSelector(".slash-menu", { timeout: 3000 });

  // Click Heading 1
  await page.click(".slash-menu-item:has-text('Heading 1')");

  // Wait
  await page.waitForTimeout(500);

  // Get editor HTML after
  const afterHtml = await editor.innerHTML();
  console.log("After slash HTML:", afterHtml);

  // Check for heading
  const hasH1 = await editor.locator("h1").count();
  console.log("H1 elements:", hasH1);

  // Should have heading
  expect(hasH1).toBeGreaterThan(0);
});
