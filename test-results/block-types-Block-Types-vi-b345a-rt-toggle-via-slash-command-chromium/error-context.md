# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: block-types.spec.ts >> Block Types via Slash Menu >> insert toggle via slash command
- Location: e2e/block-types.spec.ts:98:6

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "<details"
Received string:    "<div class=\"toggle-block\" data-open=\"true\"><button type=\"button\" class=\"toggle-chevron\" contenteditable=\"false\" aria-label=\"Toggle section\"></button><div class=\"toggle-content\"><summary>Toggle</summary><div data-details-content=\"true\"><p><br class=\"ProseMirror-trailingBreak\"></p></div></div></div>"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - complementary [ref=e4]:
        - generic [ref=e6]:
          - button "E E2E Workspace ▾" [ref=e7] [cursor=pointer]:
            - generic [ref=e8]: E
            - generic [ref=e9]: E2E Workspace
            - generic [ref=e10]: ▾
          - button "Collapse sidebar" [ref=e11] [cursor=pointer]: «
        - generic [ref=e12]:
          - button "Search… ⌘K" [ref=e13] [cursor=pointer]:
            - generic [ref=e14]: Search…
            - generic [ref=e15]: ⌘K
          - textbox "Filter visible pages" [ref=e16]
        - navigation [ref=e17]:
          - tree "Tree View" [ref=e19]:
            - treeitem "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [expanded] [level=1] [selected] [ref=e21]:
              - button "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [ref=e22] [cursor=pointer]:
                - button "⋮⋮" [ref=e23]
                - generic [ref=e24]: ▶
                - generic "Change icon" [ref=e25]: 📄
                - generic [ref=e26]: Toggle Test ms7iv6no
                - button "⋯" [ref=e27]
            - treeitem "⋮⋮ 📄 Untitled ⋯" [expanded] [level=1] [ref=e29]:
              - button "⋮⋮ 📄 Untitled ⋯" [ref=e30] [cursor=pointer]:
                - button "⋮⋮" [ref=e31]
                - generic [ref=e32]: ▶
                - generic "Change icon" [ref=e33]: 📄
                - generic [ref=e34]: Untitled
                - button "⋯" [ref=e35]
            - treeitem "⋮⋮ 📄 My Test Page ⋯" [expanded] [level=1] [ref=e37]:
              - button "⋮⋮ 📄 My Test Page ⋯" [ref=e38] [cursor=pointer]:
                - button "⋮⋮" [ref=e39]
                - generic [ref=e40]: ▶
                - generic "Change icon" [ref=e41]: 📄
                - generic [ref=e42]: My Test Page
                - button "⋯" [ref=e43]
            - treeitem "⋮⋮ 📄 Content Test ⋯" [expanded] [level=1] [ref=e45]:
              - button "⋮⋮ 📄 Content Test ⋯" [ref=e46] [cursor=pointer]:
                - button "⋮⋮" [ref=e47]
                - generic [ref=e48]: ▶
                - generic "Change icon" [ref=e49]: 📄
                - generic [ref=e50]: Content Test
                - button "⋯" [ref=e51]
            - treeitem "⋮⋮ 📄 Database Test ⋯" [expanded] [level=1] [ref=e53]:
              - button "⋮⋮ 📄 Database Test ⋯" [ref=e54] [cursor=pointer]:
                - button "⋮⋮" [ref=e55]
                - generic [ref=e56]: ▶
                - generic "Change icon" [ref=e57]: 📄
                - generic [ref=e58]: Database Test
                - button "⋯" [ref=e59]
            - treeitem "⋮⋮ 📄 DB Operations Test ⋯" [expanded] [level=1] [ref=e61]:
              - button "⋮⋮ 📄 DB Operations Test ⋯" [ref=e62] [cursor=pointer]:
                - button "⋮⋮" [ref=e63]
                - generic [ref=e64]: ▶
                - generic "Change icon" [ref=e65]: 📄
                - generic [ref=e66]: DB Operations Test
                - button "⋯" [ref=e67]
            - treeitem "⋮⋮ 📄 Block Types List ms7it5hj ⋯" [expanded] [level=1] [ref=e69]:
              - button "⋮⋮ 📄 Block Types List ms7it5hj ⋯" [ref=e70] [cursor=pointer]:
                - button "⋮⋮" [ref=e71]
                - generic [ref=e72]: ▶
                - generic "Change icon" [ref=e73]: 📄
                - generic [ref=e74]: Block Types List ms7it5hj
                - button "⋯" [ref=e75]
            - treeitem "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [expanded] [level=1] [ref=e77]:
              - button "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [ref=e78] [cursor=pointer]:
                - button "⋮⋮" [ref=e79]
                - generic [ref=e80]: ▶
                - generic "Change icon" [ref=e81]: 📄
                - generic [ref=e82]: Heading Test ms7it6i3
                - button "⋯" [ref=e83]
            - treeitem "⋮⋮ 📄 Quote Test ms7itu0z ⋯" [expanded] [level=1] [ref=e85]:
              - button "⋮⋮ 📄 Quote Test ms7itu0z ⋯" [ref=e86] [cursor=pointer]:
                - button "⋮⋮" [ref=e87]
                - generic [ref=e88]: ▶
                - generic "Change icon" [ref=e89]: 📄
                - generic [ref=e90]: Quote Test ms7itu0z
                - button "⋯" [ref=e91]
            - treeitem "⋮⋮ 📄 Divider Test ms7iuhlf ⋯" [expanded] [level=1] [ref=e93]:
              - button "⋮⋮ 📄 Divider Test ms7iuhlf ⋯" [ref=e94] [cursor=pointer]:
                - button "⋮⋮" [ref=e95]
                - generic [ref=e96]: ▶
                - generic "Change icon" [ref=e97]: 📄
                - generic [ref=e98]: Divider Test ms7iuhlf
                - button "⋯" [ref=e99]
            - treeitem "⋮⋮ 📄 Todo Test ms7iuj6h ⋯" [expanded] [level=1] [ref=e101]:
              - button "⋮⋮ 📄 Todo Test ms7iuj6h ⋯" [ref=e102] [cursor=pointer]:
                - button "⋮⋮" [ref=e103]
                - generic [ref=e104]: ▶
                - generic "Change icon" [ref=e105]: 📄
                - generic [ref=e106]: Todo Test ms7iuj6h
                - button "⋯" [ref=e107]
        - generic [ref=e108]:
          - button "+ New page" [ref=e109] [cursor=pointer]:
            - generic [ref=e110]: +
            - text: New page
          - button "? Help" [ref=e111] [cursor=pointer]:
            - generic [ref=e112]: "?"
            - text: Help
        - generic "Resize sidebar" [ref=e113]
      - status [ref=e114]
      - generic [ref=e115]:
        - generic [ref=e116]:
          - generic [ref=e117]:
            - button "📄" [ref=e118] [cursor=pointer]
            - heading "Toggle Test ms7iv6no" [level=1] [ref=e119] [cursor=pointer]
            - button "☆" [ref=e120] [cursor=pointer]
            - button "⋯" [ref=e122] [cursor=pointer]
          - generic [ref=e123]:
            - generic [ref=e125]:
              - generic:
                - button "+"
                - button "Click for options, drag to reorder":
                  - generic "Drag to reorder":
                    - img
              - textbox [active] [ref=e130]:
                - generic [ref=e131]:
                  - button "Toggle section" [ref=e132] [cursor=pointer]: ▶
                  - generic [ref=e133]:
                    - generic "Toggle" [ref=e134]
                    - paragraph [ref=e136]
            - button "+ New block" [ref=e137] [cursor=pointer]:
              - generic [ref=e138]: +
              - generic [ref=e139]: New block
          - button "▶ 0 backlinks" [ref=e141] [cursor=pointer]:
            - generic [ref=e142]: ▶
            - generic [ref=e143]: 0 backlinks
        - status [ref=e144]
    - generic:
      - contentinfo:
        - button "Open TanStack Router Devtools" [ref=e145] [cursor=pointer]:
          - generic [ref=e146]:
            - img [ref=e148]
            - img [ref=e183]
          - generic [ref=e217]: "-"
          - generic [ref=e218]: TanStack Router
  - region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  6   |  *
  7   |  * Re-written with current Tailwind-based selectors.
  8   |  * Tests assume authenticated session from auth setup.
  9   |  */
  10  | 
  11  | test.describe("Block Types via Slash Menu", () => {
  12  | 	test.beforeEach(async ({ page }) => {
  13  | 		await gotoApp(page);
  14  | 	});
  15  | 
  16  | 	const getEditorHtml = async (page: any): Promise<string> => {
  17  | 		const editor = page.locator(".ProseMirror").first();
  18  | 		return await editor.evaluate((el: HTMLElement) => el.innerHTML);
  19  | 	};
  20  | 
  21  | 	test("slash menu shows all block types", async ({ page }) => {
  22  | 		const testId = Date.now().toString(36);
  23  | 		await createPage(page, `Block Types List ${testId}`);
  24  | 		const editor = page.locator(".ProseMirror").first();
  25  | 		await editor.click();
  26  | 		await editor.press("Home");
  27  | 		await editor.press("/");
  28  | 		await page
  29  | 			.locator("text=Blocks")
  30  | 			.first()
  31  | 			.waitFor({ state: "visible", timeout: 3000 });
  32  | 
  33  | 		// Count visible block option buttons
  34  | 		const blockButtons = page.locator("button").filter({ hasText: /^[A-Z]/ });
  35  | 		const count = await blockButtons.count();
  36  | 		// There should be at least 8 block types
  37  | 		expect(count).toBeGreaterThanOrEqual(8);
  38  | 	});
  39  | 
  40  | 	test("insert heading via slash command", async ({ page }) => {
  41  | 		const testId = Date.now().toString(36);
  42  | 		await createPage(page, `Heading Test ${testId}`);
  43  | 		await openSlashMenu(page);
  44  | 		await page.locator("button").filter({ hasText: "Heading 1" }).click();
  45  | 		await page.waitForTimeout(500);
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
> 106 | 		expect(html).toContain("<details");
      |                ^ Error: expect(received).toContain(expected) // indexOf
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
  146 | 		).toBeVisible();
  147 | 	});
  148 | });
  149 | 
```