# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: block-types.spec.ts >> Block Types via Slash Menu >> insert heading via slash command
- Location: e2e/block-types.spec.ts:40:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button').filter({ hasText: 'Heading 1' })

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
            - treeitem "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [expanded] [level=1] [selected] [ref=e21]:
              - button "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [ref=e22] [cursor=pointer]:
                - button "⋮⋮" [ref=e23]
                - generic [ref=e24]: ▶
                - generic "Change icon" [ref=e25]: 📄
                - generic [ref=e26]: Heading Test ms7it6i3
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
        - generic [ref=e76]:
          - button "+ New page" [ref=e77] [cursor=pointer]:
            - generic [ref=e78]: +
            - text: New page
          - button "? Help" [ref=e79] [cursor=pointer]:
            - generic [ref=e80]: "?"
            - text: Help
        - generic "Resize sidebar" [ref=e81]
      - status [ref=e82]
      - generic [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]:
            - button "📄" [ref=e86] [cursor=pointer]
            - heading "Heading Test ms7it6i3" [level=1] [ref=e87] [cursor=pointer]
            - button "☆" [ref=e88] [cursor=pointer]
            - button "⋯" [ref=e90] [cursor=pointer]
          - generic [ref=e91]:
            - generic [ref=e93]:
              - generic [ref=e95]:
                - button "+" [ref=e96] [cursor=pointer]
                - button "Click for options, drag to reorder" [ref=e97]:
                  - generic "Drag to reorder" [ref=e98]:
                    - img [ref=e99]
              - textbox [active] [ref=e109]:
                - paragraph [ref=e110]: /
            - button "+ New block" [ref=e111] [cursor=pointer]:
              - generic [ref=e112]: +
              - generic [ref=e113]: New block
            - generic [ref=e114]:
              - generic [ref=e115]: Blocks
              - button "🖼️ Image /image" [ref=e116] [cursor=pointer]:
                - generic [ref=e117]: 🖼️
                - generic [ref=e118]:
                  - generic [ref=e119]: Image
                  - generic [ref=e120]: /image
              - button "📎 File /file" [ref=e121] [cursor=pointer]:
                - generic [ref=e122]: 📎
                - generic [ref=e123]:
                  - generic [ref=e124]: File
                  - generic [ref=e125]: /file
              - button "— Divider ---" [ref=e126] [cursor=pointer]:
                - generic [ref=e127]: —
                - generic [ref=e128]:
                  - generic [ref=e129]: Divider
                  - generic [ref=e130]: "---"
              - button "💡 Callout /callout" [ref=e131] [cursor=pointer]:
                - generic [ref=e132]: 💡
                - generic [ref=e133]:
                  - generic [ref=e134]: Callout
                  - generic [ref=e135]: /callout
              - button "▶ Toggle /toggle" [ref=e136] [cursor=pointer]:
                - generic [ref=e137]: ▶
                - generic [ref=e138]:
                  - generic [ref=e139]: Toggle
                  - generic [ref=e140]: /toggle
              - button "🗃️ Database /database" [ref=e141] [cursor=pointer]:
                - generic [ref=e142]: 🗃️
                - generic [ref=e143]:
                  - generic [ref=e144]: Database
                  - generic [ref=e145]: /database
              - button "🔗 Link to page /page" [ref=e146] [cursor=pointer]:
                - generic [ref=e147]: 🔗
                - generic [ref=e148]:
                  - generic [ref=e149]: Link to page
                  - generic [ref=e150]: /page
              - button "👤 People /people" [ref=e151] [cursor=pointer]:
                - generic [ref=e152]: 👤
                - generic [ref=e153]:
                  - generic [ref=e154]: People
                  - generic [ref=e155]: /people
              - button "👁️ View reference /view" [ref=e156] [cursor=pointer]:
                - generic [ref=e157]: 👁️
                - generic [ref=e158]:
                  - generic [ref=e159]: View reference
                  - generic [ref=e160]: /view
          - button "▶ 0 backlinks" [ref=e162] [cursor=pointer]:
            - generic [ref=e163]: ▶
            - generic [ref=e164]: 0 backlinks
        - status [ref=e165]
    - generic:
      - contentinfo:
        - button "Open TanStack Router Devtools" [ref=e166] [cursor=pointer]:
          - generic [ref=e167]:
            - img [ref=e169]
            - img [ref=e204]
          - generic [ref=e238]: "-"
          - generic [ref=e239]: TanStack Router
  - region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import { createPage, gotoApp, openSlashMenu } from "./helpers.js";
  3   | 
  4   | /**
  5   |  * Block Types via Slash Menu
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
> 44  | 		await page.locator("button").filter({ hasText: "Heading 1" }).click();
      |                                                                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
```