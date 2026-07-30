# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: block-types.spec.ts >> Block Types via Slash Menu >> slash menu filters by query
- Location: e2e/block-types.spec.ts:127:6

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button').filter({ hasText: 'Code Block' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button').filter({ hasText: 'Code Block' })

```

```yaml
- complementary:
  - button "E E2E Workspace ▾"
  - button "Collapse sidebar": «
  - button "Search… ⌘K"
  - textbox "Filter visible pages"
  - navigation:
    - tree "Tree View":
      - treeitem "⋮⋮ 📄 Filter Test ms7ivvnb ⋯" [expanded] [level=1] [selected]:
        - button "⋮⋮ 📄 Filter Test ms7ivvnb ⋯":
          - button "⋮⋮"
          - text: 📄 Filter Test ms7ivvnb
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
  - button "+ New page"
  - button "? Help"
- status
- button "📄"
- heading "Filter Test ms7ivvnb" [level=1]
- button "☆"
- button "⋯"
- button "+"
- button "Click for options, drag to reorder":
  - img
- textbox:
  - paragraph: /code
- button "+ New block"
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
  46  | 
  47  | 		const editor = page.locator(".ProseMirror").first();
  48  | 		await editor.fill("My Heading");
  49  | 		await page.waitForTimeout(500);
  50  | 
  51  | 		const html = await getEditorHtml(page);
  52  | 		expect(html).toContain("<h1>");
  53  | 		expect(html).toContain("My Heading");
  54  | 	});
  55  | 
  56  | 	test("insert quote via slash command", async ({ page }) => {
  57  | 		const testId = Date.now().toString(36);
  58  | 		await createPage(page, `Quote Test ${testId}`);
  59  | 		await openSlashMenu(page);
  60  | 		await page.locator("button").filter({ hasText: "Quote" }).click();
  61  | 		await page.waitForTimeout(500);
  62  | 
  63  | 		const editor = page.locator(".ProseMirror").first();
  64  | 		await editor.fill("This is a quote");
  65  | 		await page.waitForTimeout(500);
  66  | 
  67  | 		const html = await getEditorHtml(page);
  68  | 		expect(html).toContain("<blockquote>");
  69  | 		expect(html).toContain("This is a quote");
  70  | 	});
  71  | 
  72  | 	test("insert divider via slash command", async ({ page }) => {
  73  | 		const testId = Date.now().toString(36);
  74  | 		await createPage(page, `Divider Test ${testId}`);
  75  | 		await openSlashMenu(page);
  76  | 		await page.locator("button").filter({ hasText: "Divider" }).click();
  77  | 		await page.waitForTimeout(500);
  78  | 
  79  | 		const html = await getEditorHtml(page);
  80  | 		expect(html).toContain("<hr");
  81  | 	});
  82  | 
  83  | 	test("insert todo list via slash command", async ({ page }) => {
  84  | 		const testId = Date.now().toString(36);
  85  | 		await createPage(page, `Todo Test ${testId}`);
  86  | 		await openSlashMenu(page);
  87  | 		await page.locator("button").filter({ hasText: "Todo List" }).click();
  88  | 		await page.waitForTimeout(500);
  89  | 
  90  | 		const editor = page.locator(".ProseMirror").first();
  91  | 		await editor.fill("My task");
  92  | 		await page.waitForTimeout(500);
  93  | 
  94  | 		const html = await getEditorHtml(page);
  95  | 		expect(html).toContain("My task");
  96  | 	});
  97  | 
  98  | 	test("insert toggle via slash command", async ({ page }) => {
  99  | 		const testId = Date.now().toString(36);
  100 | 		await createPage(page, `Toggle Test ${testId}`);
  101 | 		await openSlashMenu(page);
  102 | 		await page.locator("button").filter({ hasText: "Toggle" }).click();
  103 | 		await page.waitForTimeout(500);
  104 | 
  105 | 		const html = await getEditorHtml(page);
  106 | 		expect(html).toContain("<details");
  107 | 		expect(html).toContain("<summary");
  108 | 	});
  109 | 
  110 | 	test("insert code block via slash command", async ({ page }) => {
  111 | 		const testId = Date.now().toString(36);
  112 | 		await createPage(page, `Code Test ${testId}`);
  113 | 		await openSlashMenu(page);
  114 | 		await page.locator("button").filter({ hasText: "Code Block" }).click();
  115 | 		await page.waitForTimeout(500);
  116 | 
  117 | 		const editor = page.locator(".ProseMirror").first();
  118 | 		await editor.fill("console.log('hello')");
  119 | 		await page.waitForTimeout(500);
  120 | 
  121 | 		const html = await getEditorHtml(page);
  122 | 		expect(html).toContain("<pre");
  123 | 		expect(html).toContain("<code");
  124 | 		expect(html).toContain("console.log('hello')");
  125 | 	});
  126 | 
  127 | 	test("slash menu filters by query", async ({ page }) => {
  128 | 		const testId = Date.now().toString(36);
  129 | 		await createPage(page, `Filter Test ${testId}`);
  130 | 		const editor = page.locator(".ProseMirror").first();
  131 | 		await editor.click();
  132 | 		await editor.press("Home");
  133 | 		await editor.press("/");
  134 | 		await page
  135 | 			.locator("text=Blocks")
  136 | 			.first()
  137 | 			.waitFor({ state: "visible", timeout: 3000 });
  138 | 
  139 | 		// Type "code" to filter
  140 | 		await editor.pressSequentially("code");
  141 | 		await page.waitForTimeout(1500);
  142 | 
  143 | 		// Verify Code Block is visible in filtered results
  144 | 		await expect(
  145 | 			page.locator("button").filter({ hasText: "Code Block" }),
> 146 | 		).toBeVisible();
      |     ^ Error: expect(locator).toBeVisible() failed
  147 | 	});
  148 | });
  149 | 
```