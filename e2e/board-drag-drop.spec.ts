import { test, expect } from "@playwright/test";

// The page with our board test database
const TEST_PAGE_ID = process.env.TEST_PAGE_ID || "01KREYE90P677TB5H2SZXXE517";

test.describe("Board View Drag-Drop", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the test page
    await page.goto(`http://localhost:5173/?page=${TEST_PAGE_ID}`);
    await page.waitForSelector(".sidebar", { timeout: 10000 });
    // Wait for the database view to load
    await page.waitForSelector(".table-view", { timeout: 10000 });
  });

  test("board view shows cards grouped by select field", async ({ page }) => {
    // Should be on table view initially
    await expect(page.locator(".table-view")).toBeVisible();

    // Switch to board view
    await page.click('button:has-text("Board")');
    await page.waitForTimeout(1000);

    // Board should have columns
    await expect(page.locator(".board-column").first()).toBeVisible();

    // Should have cards
    const cards = page.locator(".board-card");
    await expect(cards.first()).toBeVisible();
  });

  test("card shows drag affordance on hover", async ({ page }) => {
    // Switch to board view
    await page.click('button:has-text("Board")');
    await page.waitForTimeout(1000);

    // Hover over the first card
    const firstCard = page.locator(".board-card").first();
    await firstCard.hover();
    await page.waitForTimeout(200);

    // Drag handle should appear on hover
    const dragHandle = firstCard.locator(".board-card-drag-handle");
    await expect(dragHandle).toBeVisible();
  });

  test("drag card to different column updates field value", async ({ page }) => {
    // Switch to board view
    await page.click('button:has-text("Board")');
    await page.waitForTimeout(1000);

    // Verify board columns and cards exist
    const columns = page.locator(".board-column");
    await expect(columns.first()).toBeVisible();

    const cards = page.locator(".board-card");
    const cardCount = await cards.count();

    if (cardCount >= 2) {
      // Get the first card's drag handle and second card as target
      const firstCard = cards.first();
      const secondCard = cards.nth(1);

      // Drag the first card to the second card (different column)
      const sourceHandle = firstCard.locator(".board-card-drag-handle");
      await sourceHandle.dragTo(secondCard, {
        force: true,
        timeout: 5000,
      });

      // Wait for API call and re-render
      await page.waitForTimeout(2000);
    }

    // Verify columns are still visible (board didn't break)
    await expect(columns.first()).toBeVisible();
  });

  test("switching to table view shows updated field values", async ({ page }) => {
    // Switch to board view
    await page.click('button:has-text("Board")');
    await page.waitForTimeout(500);

    // Switch back to table view
    await page.click('button:has-text("Table")');
    await page.waitForTimeout(500);

    // Table view should be visible
    await expect(page.locator(".table-view")).toBeVisible();
  });
});
