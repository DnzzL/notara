# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-drag-drop.spec.ts >> Board View Drag-Drop >> board view shows cards grouped by a select field
- Location: e2e/board-drag-drop.spec.ts:44:6

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[class*="grid"]').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[class*="grid"]').first()

```

```yaml
- complementary:
  - button "E E2E Workspace ▾"
  - button "Collapse sidebar": «
  - button "Search… ⌘K"
  - textbox "Filter visible pages"
  - navigation:
    - tree "Tree View":
      - treeitem "⋮⋮ 📄 Board Test ms7iw1s3 ⋯" [expanded] [level=1] [selected]:
        - button "⋮⋮ 📄 Board Test ms7iw1s3 ⋯":
          - button "⋮⋮"
          - text: 📄 Board Test ms7iw1s3
          - button "⋯"
      - treeitem "⋮⋮ 📄 Untitled ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Untitled ⋯":
          - button "⋮⋮"
          - text: 📄 Untitled
          - button "⋯"
      - treeitem "⋮⋮ 📄 My Test Page ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 My Test Page ⋯":
          - button "⋮⋮"
          - text: 📄 My Test Page
          - button "⋯"
      - treeitem "⋮⋮ 📄 Content Test ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Content Test ⋯":
          - button "⋮⋮"
          - text: 📄 Content Test
          - button "⋯"
      - treeitem "⋮⋮ 📄 Database Test ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Database Test ⋯":
          - button "⋮⋮"
          - text: 📄 Database Test
          - button "⋯"
      - treeitem "⋮⋮ 📄 DB Operations Test ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 DB Operations Test ⋯":
          - button "⋮⋮"
          - text: 📄 DB Operations Test
          - button "⋯"
      - treeitem "⋮⋮ 📄 Block Types List ms7it5hj ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Block Types List ms7it5hj ⋯":
          - button "⋮⋮"
          - text: 📄 Block Types List ms7it5hj
          - button "⋯"
      - treeitem "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Heading Test ms7it6i3 ⋯":
          - button "⋮⋮"
          - text: 📄 Heading Test ms7it6i3
          - button "⋯"
      - treeitem "⋮⋮ 📄 Quote Test ms7itu0z ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Quote Test ms7itu0z ⋯":
          - button "⋮⋮"
          - text: 📄 Quote Test ms7itu0z
          - button "⋯"
      - treeitem "⋮⋮ 📄 Divider Test ms7iuhlf ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Divider Test ms7iuhlf ⋯":
          - button "⋮⋮"
          - text: 📄 Divider Test ms7iuhlf
          - button "⋯"
      - treeitem "⋮⋮ 📄 Todo Test ms7iuj6h ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Todo Test ms7iuj6h ⋯":
          - button "⋮⋮"
          - text: 📄 Todo Test ms7iuj6h
          - button "⋯"
      - treeitem "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Toggle Test ms7iv6no ⋯":
          - button "⋮⋮"
          - text: 📄 Toggle Test ms7iv6no
          - button "⋯"
      - treeitem "⋮⋮ 📄 Code Test ms7iv86b ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Code Test ms7iv86b ⋯":
          - button "⋮⋮"
          - text: 📄 Code Test ms7iv86b
          - button "⋯"
      - treeitem "⋮⋮ 📄 Filter Test ms7ivvnb ⋯" [expanded] [level=1]:
        - button "⋮⋮ 📄 Filter Test ms7ivvnb ⋯":
          - button "⋮⋮"
          - text: 📄 Filter Test ms7ivvnb
          - button "⋯"
  - button "+ New page"
  - button "? Help"
- status
- button "📄"
- heading "Board Test ms7iw1s3" [level=1]
- button "☆"
- button "⋯"
- button "+"
- button "Click for options, drag to reorder":
  - img
- textbox:
  - paragraph: Type '/' for commands
- button "+ New block"
- button "+"
- button "Click for options, drag to reorder":
  - img
- button "All":
  - img
  - text: All
  - img
- tablist:
  - tab "Table"
  - tab "Board" [selected]
  - tab "Calendar"
- text: "Group by:"
- combobox:
  - option "None" [selected]
  - option "Notes (text)"
- button "Fields"
- button "Filter":
  - img
  - text: Filter
- button "Sort":
  - img
  - text: Sort
- text: Untitled
- button "Drag to reorder column":
  - img
- heading "All (0)" [level=3]
- button "+ New"
- status
- button "▶ 0 backlinks"
- status
- contentinfo:
  - button "Open TanStack Router Devtools":
    - img
    - img
    - text: "- TanStack Router"
- region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { createPage, gotoApp, openSlashMenu } from "./helpers.js";
  3  | 
  4  | /**
  5  |  * Board View Drag-Drop
  6  |  *
  7  |  * Re-written with current Tailwind-based selectors. The board view uses
  8  |  * @dnd-kit for drag-and-drop; cards are rendered inside a grid layout with
  9  |  * CSS classes from Tailwind. No semantic class names like .board-card remain
  10 |  * after the NOT-25 Tailwind migration — we rely on role attributes, text
  11 |  * content, and structural selectors.
  12 |  *
  13 |  * These tests create a database inline via the slash menu and set up
  14 |  * a board view to test against.
  15 |  */
  16 | 
  17 | test.describe("Board View Drag-Drop", () => {
  18 | 	test.beforeEach(async ({ page }) => {
  19 | 		// Navigate to the app
  20 | 		await gotoApp(page);
  21 | 	});
  22 | 
  23 | 	const createDatabaseWithBoardView = async (page: any) => {
  24 | 		const editor = await createPage(
  25 | 			page,
  26 | 			`Board Test ${Date.now().toString(36)}`,
  27 | 		);
  28 | 
  29 | 		// Open slash menu and insert Database
  30 | 		await openSlashMenu(page, editor);
  31 | 		await page.locator("button").filter({ hasText: "Database" }).click();
  32 | 
  33 | 		// Wait for the database table to render
  34 | 		await page
  35 | 			.locator("table.w-full")
  36 | 			.waitFor({ state: "visible", timeout: 10000 });
  37 | 
  38 | 		// Switch to Board view by clicking the "Board" tab
  39 | 		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
  40 | 		await boardTab.click();
  41 | 		await page.waitForTimeout(1500);
  42 | 	};
  43 | 
  44 | 	test("board view shows cards grouped by a select field", async ({ page }) => {
  45 | 		await createDatabaseWithBoardView(page);
  46 | 
  47 | 		// The board view renders a DndContext with droppable columns.
  48 | 		// Look for the board view container — columns are rendered as divs
  49 | 		// with cards inside them.
  50 | 		// When there's no select field to group by, the board shows a prompt.
  51 | 		const boardContainer = page.locator('[class*="grid"]').first();
> 52 | 		await expect(boardContainer).toBeVisible();
     |                                ^ Error: expect(locator).toBeVisible() failed
  53 | 
  54 | 		// Verify the Board tab has aria-selected="true"
  55 | 		const boardTab = page.locator('[role="tab"][aria-selected="true"]');
  56 | 		await expect(boardTab).toContainText("Board");
  57 | 	});
  58 | 
  59 | 	test("switching between board and table views works", async ({ page }) => {
  60 | 		await createDatabaseWithBoardView(page);
  61 | 
  62 | 		// We should be on Board view
  63 | 		let activeTab = page.locator('[role="tab"][aria-selected="true"]');
  64 | 		await expect(activeTab).toContainText("Board");
  65 | 
  66 | 		// Switch back to Table view
  67 | 		const tableTab = page.locator('[role="tab"]').filter({ hasText: "Table" });
  68 | 		await tableTab.click();
  69 | 		await page.waitForTimeout(500);
  70 | 
  71 | 		// The Table view should now be active
  72 | 		activeTab = page.locator('[role="tab"][aria-selected="true"]');
  73 | 		await expect(activeTab).toContainText("Table");
  74 | 
  75 | 		// The table should be visible
  76 | 		await expect(page.locator("table.w-full")).toBeVisible();
  77 | 
  78 | 		// Switch back to Board
  79 | 		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
  80 | 		await boardTab.click();
  81 | 		await page.waitForTimeout(500);
  82 | 
  83 | 		activeTab = page.locator('[role="tab"][aria-selected="true"]');
  84 | 		await expect(activeTab).toContainText("Board");
  85 | 	});
  86 | });
  87 | 
```