# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-regression.spec.ts >> Visual regression >> database table view
- Location: e2e/visual-regression.spec.ts:119:6

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('button', { name: /database/i }) resolved to 2 elements:
    1) <div dir="ltr" role="button" tabindex="-1" data-path="4" data-depth="1" data-state="open" data-scope="tree-view" data-part="branch-control" data-value="01KYSHQHX7GAZ5YCX5YB6PQWQW" id="tree:_r_3_:node:01KYSHQHX7GAZ5YCX5YB6PQWQW" class="group relative flex items-center gap-0.5 min-h-[28px] px-1 rounded-lg text-[13px] text-text-sb-2 cursor-pointer transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.045)] hover:text-text-sb">…</div> aka getByRole('button', { name: '⋮⋮ 📄 Database Test ⋯' })
    2) <button class="flex items-center gap-2.5 w-full px-2.5 py-2 border-none bg-transparent cursor-pointer text-left text-[13.5px] text-text-2 rounded font-[family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text ">…</button> aka getByRole('button', { name: '🗃️ Database /database' })

Call log:
  - waiting for getByRole('button', { name: /database/i })

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
            - treeitem "⋮⋮ 📄 DB Table Snap ⋯" [expanded] [level=1] [selected] [ref=e21]:
              - button "⋮⋮ 📄 DB Table Snap ⋯" [ref=e22] [cursor=pointer]:
                - button "⋮⋮" [ref=e23]
                - generic [ref=e24]: ▶
                - generic "Change icon" [ref=e25]: 📄
                - generic [ref=e26]: DB Table Snap
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
            - treeitem "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [expanded] [level=1] [ref=e109]:
              - button "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [ref=e110] [cursor=pointer]:
                - button "⋮⋮" [ref=e111]
                - generic [ref=e112]: ▶
                - generic "Change icon" [ref=e113]: 📄
                - generic [ref=e114]: Toggle Test ms7iv6no
                - button "⋯" [ref=e115]
            - treeitem "⋮⋮ 📄 Code Test ms7iv86b ⋯" [expanded] [level=1] [ref=e117]:
              - button "⋮⋮ 📄 Code Test ms7iv86b ⋯" [ref=e118] [cursor=pointer]:
                - button "⋮⋮" [ref=e119]
                - generic [ref=e120]: ▶
                - generic "Change icon" [ref=e121]: 📄
                - generic [ref=e122]: Code Test ms7iv86b
                - button "⋯" [ref=e123]
            - treeitem "⋮⋮ 📄 Filter Test ms7ivvnb ⋯" [expanded] [level=1] [ref=e125]:
              - button "⋮⋮ 📄 Filter Test ms7ivvnb ⋯" [ref=e126] [cursor=pointer]:
                - button "⋮⋮" [ref=e127]
                - generic [ref=e128]: ▶
                - generic "Change icon" [ref=e129]: 📄
                - generic [ref=e130]: Filter Test ms7ivvnb
                - button "⋯" [ref=e131]
            - treeitem "⋮⋮ 📄 Board Test ms7iw1s3 ⋯" [expanded] [level=1] [ref=e133]:
              - button "⋮⋮ 📄 Board Test ms7iw1s3 ⋯" [ref=e134] [cursor=pointer]:
                - button "⋮⋮" [ref=e135]
                - generic [ref=e136]: ▶
                - generic "Change icon" [ref=e137]: 📄
                - generic [ref=e138]: Board Test ms7iw1s3
                - button "⋯" [ref=e139]
            - treeitem "⋮⋮ 📄 Board Test ms7iw7zs ⋯" [expanded] [level=1] [ref=e141]:
              - button "⋮⋮ 📄 Board Test ms7iw7zs ⋯" [ref=e142] [cursor=pointer]:
                - button "⋮⋮" [ref=e143]
                - generic [ref=e144]: ▶
                - generic "Change icon" [ref=e145]: 📄
                - generic [ref=e146]: Board Test ms7iw7zs
                - button "⋯" [ref=e147]
            - treeitem "⋮⋮ 📄 Calendar Test ms7iwayh ⋯" [expanded] [level=1] [ref=e149]:
              - button "⋮⋮ 📄 Calendar Test ms7iwayh ⋯" [ref=e150] [cursor=pointer]:
                - button "⋮⋮" [ref=e151]
                - generic [ref=e152]: ▶
                - generic "Change icon" [ref=e153]: 📄
                - generic [ref=e154]: Calendar Test ms7iwayh
                - button "⋯" [ref=e155]
            - treeitem "⋮⋮ 📄 Calendar Test ms7iwye9 ⋯" [expanded] [level=1] [ref=e157]:
              - button "⋮⋮ 📄 Calendar Test ms7iwye9 ⋯" [ref=e158] [cursor=pointer]:
                - button "⋮⋮" [ref=e159]
                - generic [ref=e160]: ▶
                - generic "Change icon" [ref=e161]: 📄
                - generic [ref=e162]: Calendar Test ms7iwye9
                - button "⋯" [ref=e163]
            - treeitem "⋮⋮ 📄 Calendar Test ms7ixlrg ⋯" [expanded] [level=1] [ref=e165]:
              - button "⋮⋮ 📄 Calendar Test ms7ixlrg ⋯" [ref=e166] [cursor=pointer]:
                - button "⋮⋮" [ref=e167]
                - generic [ref=e168]: ▶
                - generic "Change icon" [ref=e169]: 📄
                - generic [ref=e170]: Calendar Test ms7ixlrg
                - button "⋯" [ref=e171]
            - treeitem "⋮⋮ 📄 Visual Regression ⋯" [expanded] [level=1] [ref=e173]:
              - button "⋮⋮ 📄 Visual Regression ⋯" [ref=e174] [cursor=pointer]:
                - button "⋮⋮" [ref=e175]
                - generic [ref=e176]: ▶
                - generic "Change icon" [ref=e177]: 📄
                - generic [ref=e178]: Visual Regression
                - button "⋯" [ref=e179]
            - treeitem "⋮⋮ 📄 Page Alpha ⋯" [expanded] [level=1] [ref=e181]:
              - button "⋮⋮ 📄 Page Alpha ⋯" [ref=e182] [cursor=pointer]:
                - button "⋮⋮" [ref=e183]
                - generic [ref=e184]: ▶
                - generic "Change icon" [ref=e185]: 📄
                - generic [ref=e186]: Page Alpha
                - button "⋯" [ref=e187]
            - treeitem "⋮⋮ 📄 Page Beta ⋯" [expanded] [level=1] [ref=e189]:
              - button "⋮⋮ 📄 Page Beta ⋯" [ref=e190] [cursor=pointer]:
                - button "⋮⋮" [ref=e191]
                - generic [ref=e192]: ▶
                - generic "Change icon" [ref=e193]: 📄
                - generic [ref=e194]: Page Beta
                - button "⋯" [ref=e195]
        - generic [ref=e196]:
          - button "+ New page" [ref=e197] [cursor=pointer]:
            - generic [ref=e198]: +
            - text: New page
          - button "? Help" [ref=e199] [cursor=pointer]:
            - generic [ref=e200]: "?"
            - text: Help
        - generic "Resize sidebar" [ref=e201]
      - status [ref=e202]
      - generic [ref=e203]:
        - generic [ref=e204]:
          - generic [ref=e205]:
            - button "📄" [ref=e206] [cursor=pointer]
            - heading "DB Table Snap" [level=1] [ref=e207] [cursor=pointer]
            - button "☆" [ref=e208] [cursor=pointer]
            - button "⋯" [ref=e210] [cursor=pointer]
          - generic [ref=e211]:
            - generic [ref=e213]:
              - generic:
                - button "+"
                - button "Click for options, drag to reorder":
                  - generic "Drag to reorder":
                    - img
              - textbox [active] [ref=e218]:
                - paragraph [ref=e219]: /
            - button "+ New block" [ref=e220] [cursor=pointer]:
              - generic [ref=e221]: +
              - generic [ref=e222]: New block
            - generic [ref=e223]:
              - generic [ref=e224]: Blocks
              - button "🖼️ Image /image" [ref=e225] [cursor=pointer]:
                - generic [ref=e226]: 🖼️
                - generic [ref=e227]:
                  - generic [ref=e228]: Image
                  - generic [ref=e229]: /image
              - button "📎 File /file" [ref=e230] [cursor=pointer]:
                - generic [ref=e231]: 📎
                - generic [ref=e232]:
                  - generic [ref=e233]: File
                  - generic [ref=e234]: /file
              - button "— Divider ---" [ref=e235] [cursor=pointer]:
                - generic [ref=e236]: —
                - generic [ref=e237]:
                  - generic [ref=e238]: Divider
                  - generic [ref=e239]: "---"
              - button "💡 Callout /callout" [ref=e240] [cursor=pointer]:
                - generic [ref=e241]: 💡
                - generic [ref=e242]:
                  - generic [ref=e243]: Callout
                  - generic [ref=e244]: /callout
              - button "▶ Toggle /toggle" [ref=e245] [cursor=pointer]:
                - generic [ref=e246]: ▶
                - generic [ref=e247]:
                  - generic [ref=e248]: Toggle
                  - generic [ref=e249]: /toggle
              - button "🗃️ Database /database" [ref=e250] [cursor=pointer]:
                - generic [ref=e251]: 🗃️
                - generic [ref=e252]:
                  - generic [ref=e253]: Database
                  - generic [ref=e254]: /database
              - button "🔗 Link to page /page" [ref=e255] [cursor=pointer]:
                - generic [ref=e256]: 🔗
                - generic [ref=e257]:
                  - generic [ref=e258]: Link to page
                  - generic [ref=e259]: /page
              - button "👤 People /people" [ref=e260] [cursor=pointer]:
                - generic [ref=e261]: 👤
                - generic [ref=e262]:
                  - generic [ref=e263]: People
                  - generic [ref=e264]: /people
              - button "👁️ View reference /view" [ref=e265] [cursor=pointer]:
                - generic [ref=e266]: 👁️
                - generic [ref=e267]:
                  - generic [ref=e268]: View reference
                  - generic [ref=e269]: /view
          - button "▶ 0 backlinks" [ref=e271] [cursor=pointer]:
            - generic [ref=e272]: ▶
            - generic [ref=e273]: 0 backlinks
        - status [ref=e274]
    - generic:
      - contentinfo:
        - button "Open TanStack Router Devtools" [ref=e275] [cursor=pointer]:
          - generic [ref=e276]:
            - img [ref=e278]
            - img [ref=e313]
          - generic [ref=e347]: "-"
          - generic [ref=e348]: TanStack Router
  - region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  33  |  * Set the page title. The title renders as an h1; clicking it shows an input.
  34  |  */
  35  | async function setPageTitle(page: any, title: string) {
  36  | 	await page.evaluate(() => {
  37  | 		const h1 = document.querySelector("h1");
  38  | 		if (h1) (h1 as HTMLElement).click();
  39  | 	});
  40  | 	const input = page.locator('input[name="page-title"]');
  41  | 	await expect(input).toBeVisible({ timeout: 5000 });
  42  | 	await input.fill(title);
  43  | 	await input.press("Enter");
  44  | }
  45  | 
  46  | /**
  47  |  * Ensure the page has at least one block (click "This page is empty" if needed).
  48  |  */
  49  | async function ensureEditor(page: any) {
  50  | 	const emptyState = page.getByText("This page is empty");
  51  | 	if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
  52  | 		await emptyState.click();
  53  | 	}
  54  | 	const editor = page.locator(".ProseMirror");
  55  | 	await editor.waitFor({ state: "attached", timeout: 10000 });
  56  | 	return editor;
  57  | }
  58  | 
  59  | /**
  60  |  * Stabilise the page for screenshot: hide caret + wait for animations.
  61  |  */
  62  | async function stabiliseForScreenshot(page: any) {
  63  | 	await page.addStyleTag({
  64  | 		content: `* { caret-color: transparent !important; }`,
  65  | 	});
  66  | 	await page.waitForTimeout(500);
  67  | }
  68  | 
  69  | test.describe("Visual regression", () => {
  70  | 	test.beforeEach(async ({ page }) => {
  71  | 		await page.goto("/");
  72  | 		await page.emulateMedia({ reducedMotion: "reduce" });
  73  | 		await page.waitForSelector("h1", { timeout: 15000 });
  74  | 		try {
  75  | 			await page.waitForSelector("[data-sidebar]", { timeout: 10000 });
  76  | 		} catch {
  77  | 			// Authenticated page not reached
  78  | 		}
  79  | 	});
  80  | 
  81  | 	test("block editor with typed content", async ({ page }) => {
  82  | 		await createBlankPage(page);
  83  | 		await setPageTitle(page, "Visual Regression");
  84  | 
  85  | 		const editor = await ensureEditor(page);
  86  | 		await page.evaluate(() => {
  87  | 			const el = document.querySelector(".ProseMirror");
  88  | 			if (el) (el as HTMLElement).focus();
  89  | 		});
  90  | 		await editor.fill(
  91  | 			"This is some sample content for visual regression testing.",
  92  | 		);
  93  | 
  94  | 		await stabiliseForScreenshot(page);
  95  | 		await expect(page.locator(".editor")).toHaveScreenshot("block-editor.png", {
  96  | 			maxDiffPixels: 100,
  97  | 			animations: "disabled",
  98  | 			timeout: 15000,
  99  | 		});
  100 | 	});
  101 | 
  102 | 	test("sidebar with pages", async ({ page }) => {
  103 | 		const sidebar = page.locator("[data-sidebar]");
  104 | 		await expect(sidebar).toBeVisible({ timeout: 10000 });
  105 | 
  106 | 		for (const title of ["Page Alpha", "Page Beta"]) {
  107 | 			await createBlankPage(page);
  108 | 			await setPageTitle(page, title);
  109 | 			await page.waitForTimeout(300);
  110 | 		}
  111 | 
  112 | 		await page.waitForTimeout(500);
  113 | 		await expect(sidebar).toHaveScreenshot("sidebar-pages.png", {
  114 | 			maxDiffPixels: 100,
  115 | 			animations: "disabled",
  116 | 		});
  117 | 	});
  118 | 
  119 | 	test("database table view", async ({ page }) => {
  120 | 		await createBlankPage(page);
  121 | 		await setPageTitle(page, "DB Table Snap");
  122 | 
  123 | 		const editor = await ensureEditor(page);
  124 | 		await page.evaluate(() => {
  125 | 			const el = document.querySelector(".ProseMirror");
  126 | 			if (el) (el as HTMLElement).focus();
  127 | 		});
  128 | 		await editor.press("Home");
  129 | 		await editor.press("/");
  130 | 
  131 | 		// Wait for slash command menu (has heading "Blocks")
  132 | 		await expect(page.getByText("Blocks")).toBeVisible({ timeout: 3000 });
> 133 | 		await page.getByRole("button", { name: /database/i }).click();
      |                                                         ^ Error: locator.click: Error: strict mode violation: getByRole('button', { name: /database/i }) resolved to 2 elements:
  134 | 
  135 | 		// Wait for the database table to render
  136 | 		await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
  137 | 
  138 | 		await stabiliseForScreenshot(page);
  139 | 		await expect(page.locator(".editor")).toHaveScreenshot(
  140 | 			"database-table-view.png",
  141 | 			{ maxDiffPixels: 100, animations: "disabled" },
  142 | 		);
  143 | 	});
  144 | 
  145 | 	test("board view", async ({ page }) => {
  146 | 		await createBlankPage(page);
  147 | 		await setPageTitle(page, "Board View Snap");
  148 | 
  149 | 		const editor = await ensureEditor(page);
  150 | 		await page.evaluate(() => {
  151 | 			const el = document.querySelector(".ProseMirror");
  152 | 			if (el) (el as HTMLElement).focus();
  153 | 		});
  154 | 		await editor.press("Home");
  155 | 		await editor.press("/");
  156 | 
  157 | 		// Wait for slash command menu (has heading "Blocks")
  158 | 		await expect(page.getByText("Blocks")).toBeVisible({ timeout: 3000 });
  159 | 		await page.getByRole("button", { name: /database/i }).click();
  160 | 		await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
  161 | 
  162 | 		// Switch to board view
  163 | 		const boardTab = page.getByRole("tab").filter({ hasText: /board/i });
  164 | 		if (await boardTab.isVisible({ timeout: 3000 }).catch(() => false)) {
  165 | 			await boardTab.click();
  166 | 			await page.waitForTimeout(1000);
  167 | 		}
  168 | 
  169 | 		await stabiliseForScreenshot(page);
  170 | 		await expect(page.locator(".editor")).toHaveScreenshot(
  171 | 			"database-board-view.png",
  172 | 			{ maxDiffPixels: 100, animations: "disabled" },
  173 | 		);
  174 | 	});
  175 | });
  176 | 
```