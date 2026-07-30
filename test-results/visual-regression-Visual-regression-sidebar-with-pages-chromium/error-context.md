# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-regression.spec.ts >> Visual regression >> sidebar with pages
- Location: e2e/visual-regression.spec.ts:102:6

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('[data-sidebar]')
  4341 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: sidebar-pages.png

Call log:
  - Expect "toHaveScreenshot(sidebar-pages.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('[data-sidebar]')
    - locator resolved to <aside data-sidebar="true" class="bg-sb border-r border-border-sb flex flex-col shrink-0 relative min-w-[200px] max-w-[480px]">…</aside>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 4341 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('[data-sidebar]')
    - locator resolved to <aside data-sidebar="true" class="bg-sb border-r border-border-sb flex flex-col shrink-0 relative min-w-[200px] max-w-[480px]">…</aside>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 4341 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
            - treeitem "⋮⋮ 📄 Page Beta ⋯" [expanded] [level=1] [selected] [ref=e21]:
              - button "⋮⋮ 📄 Page Beta ⋯" [ref=e22] [cursor=pointer]:
                - button "⋮⋮" [ref=e23]
                - generic [ref=e24]: ▶
                - generic "Change icon" [ref=e25]: 📄
                - generic [ref=e26]: Page Beta
                - button "⋯" [ref=e27]
            - treeitem "⋮⋮ 📄 Page Alpha ⋯" [expanded] [level=1] [ref=e29]:
              - button "⋮⋮ 📄 Page Alpha ⋯" [ref=e30] [cursor=pointer]:
                - button "⋮⋮" [ref=e31]
                - generic [ref=e32]: ▶
                - generic "Change icon" [ref=e33]: 📄
                - generic [ref=e34]: Page Alpha
                - button "⋯" [ref=e35]
            - treeitem "⋮⋮ 📄 Untitled ⋯" [expanded] [level=1] [ref=e37]:
              - button "⋮⋮ 📄 Untitled ⋯" [ref=e38] [cursor=pointer]:
                - button "⋮⋮" [ref=e39]
                - generic [ref=e40]: ▶
                - generic "Change icon" [ref=e41]: 📄
                - generic [ref=e42]: Untitled
                - button "⋯" [ref=e43]
            - treeitem "⋮⋮ 📄 My Test Page ⋯" [expanded] [level=1] [ref=e45]:
              - button "⋮⋮ 📄 My Test Page ⋯" [ref=e46] [cursor=pointer]:
                - button "⋮⋮" [ref=e47]
                - generic [ref=e48]: ▶
                - generic "Change icon" [ref=e49]: 📄
                - generic [ref=e50]: My Test Page
                - button "⋯" [ref=e51]
            - treeitem "⋮⋮ 📄 Content Test ⋯" [expanded] [level=1] [ref=e53]:
              - button "⋮⋮ 📄 Content Test ⋯" [ref=e54] [cursor=pointer]:
                - button "⋮⋮" [ref=e55]
                - generic [ref=e56]: ▶
                - generic "Change icon" [ref=e57]: 📄
                - generic [ref=e58]: Content Test
                - button "⋯" [ref=e59]
            - treeitem "⋮⋮ 📄 Database Test ⋯" [expanded] [level=1] [ref=e61]:
              - button "⋮⋮ 📄 Database Test ⋯" [ref=e62] [cursor=pointer]:
                - button "⋮⋮" [ref=e63]
                - generic [ref=e64]: ▶
                - generic "Change icon" [ref=e65]: 📄
                - generic [ref=e66]: Database Test
                - button "⋯" [ref=e67]
            - treeitem "⋮⋮ 📄 DB Operations Test ⋯" [expanded] [level=1] [ref=e69]:
              - button "⋮⋮ 📄 DB Operations Test ⋯" [ref=e70] [cursor=pointer]:
                - button "⋮⋮" [ref=e71]
                - generic [ref=e72]: ▶
                - generic "Change icon" [ref=e73]: 📄
                - generic [ref=e74]: DB Operations Test
                - button "⋯" [ref=e75]
            - treeitem "⋮⋮ 📄 Block Types List ms7it5hj ⋯" [expanded] [level=1] [ref=e77]:
              - button "⋮⋮ 📄 Block Types List ms7it5hj ⋯" [ref=e78] [cursor=pointer]:
                - button "⋮⋮" [ref=e79]
                - generic [ref=e80]: ▶
                - generic "Change icon" [ref=e81]: 📄
                - generic [ref=e82]: Block Types List ms7it5hj
                - button "⋯" [ref=e83]
            - treeitem "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [expanded] [level=1] [ref=e85]:
              - button "⋮⋮ 📄 Heading Test ms7it6i3 ⋯" [ref=e86] [cursor=pointer]:
                - button "⋮⋮" [ref=e87]
                - generic [ref=e88]: ▶
                - generic "Change icon" [ref=e89]: 📄
                - generic [ref=e90]: Heading Test ms7it6i3
                - button "⋯" [ref=e91]
            - treeitem "⋮⋮ 📄 Quote Test ms7itu0z ⋯" [expanded] [level=1] [ref=e93]:
              - button "⋮⋮ 📄 Quote Test ms7itu0z ⋯" [ref=e94] [cursor=pointer]:
                - button "⋮⋮" [ref=e95]
                - generic [ref=e96]: ▶
                - generic "Change icon" [ref=e97]: 📄
                - generic [ref=e98]: Quote Test ms7itu0z
                - button "⋯" [ref=e99]
            - treeitem "⋮⋮ 📄 Divider Test ms7iuhlf ⋯" [expanded] [level=1] [ref=e101]:
              - button "⋮⋮ 📄 Divider Test ms7iuhlf ⋯" [ref=e102] [cursor=pointer]:
                - button "⋮⋮" [ref=e103]
                - generic [ref=e104]: ▶
                - generic "Change icon" [ref=e105]: 📄
                - generic [ref=e106]: Divider Test ms7iuhlf
                - button "⋯" [ref=e107]
            - treeitem "⋮⋮ 📄 Todo Test ms7iuj6h ⋯" [expanded] [level=1] [ref=e109]:
              - button "⋮⋮ 📄 Todo Test ms7iuj6h ⋯" [ref=e110] [cursor=pointer]:
                - button "⋮⋮" [ref=e111]
                - generic [ref=e112]: ▶
                - generic "Change icon" [ref=e113]: 📄
                - generic [ref=e114]: Todo Test ms7iuj6h
                - button "⋯" [ref=e115]
            - treeitem "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [expanded] [level=1] [ref=e117]:
              - button "⋮⋮ 📄 Toggle Test ms7iv6no ⋯" [ref=e118] [cursor=pointer]:
                - button "⋮⋮" [ref=e119]
                - generic [ref=e120]: ▶
                - generic "Change icon" [ref=e121]: 📄
                - generic [ref=e122]: Toggle Test ms7iv6no
                - button "⋯" [ref=e123]
            - treeitem "⋮⋮ 📄 Code Test ms7iv86b ⋯" [expanded] [level=1] [ref=e125]:
              - button "⋮⋮ 📄 Code Test ms7iv86b ⋯" [ref=e126] [cursor=pointer]:
                - button "⋮⋮" [ref=e127]
                - generic [ref=e128]: ▶
                - generic "Change icon" [ref=e129]: 📄
                - generic [ref=e130]: Code Test ms7iv86b
                - button "⋯" [ref=e131]
            - treeitem "⋮⋮ 📄 Filter Test ms7ivvnb ⋯" [expanded] [level=1] [ref=e133]:
              - button "⋮⋮ 📄 Filter Test ms7ivvnb ⋯" [ref=e134] [cursor=pointer]:
                - button "⋮⋮" [ref=e135]
                - generic [ref=e136]: ▶
                - generic "Change icon" [ref=e137]: 📄
                - generic [ref=e138]: Filter Test ms7ivvnb
                - button "⋯" [ref=e139]
            - treeitem "⋮⋮ 📄 Board Test ms7iw1s3 ⋯" [expanded] [level=1] [ref=e141]:
              - button "⋮⋮ 📄 Board Test ms7iw1s3 ⋯" [ref=e142] [cursor=pointer]:
                - button "⋮⋮" [ref=e143]
                - generic [ref=e144]: ▶
                - generic "Change icon" [ref=e145]: 📄
                - generic [ref=e146]: Board Test ms7iw1s3
                - button "⋯" [ref=e147]
            - treeitem "⋮⋮ 📄 Board Test ms7iw7zs ⋯" [expanded] [level=1] [ref=e149]:
              - button "⋮⋮ 📄 Board Test ms7iw7zs ⋯" [ref=e150] [cursor=pointer]:
                - button "⋮⋮" [ref=e151]
                - generic [ref=e152]: ▶
                - generic "Change icon" [ref=e153]: 📄
                - generic [ref=e154]: Board Test ms7iw7zs
                - button "⋯" [ref=e155]
            - treeitem "⋮⋮ 📄 Calendar Test ms7iwayh ⋯" [expanded] [level=1] [ref=e157]:
              - button "⋮⋮ 📄 Calendar Test ms7iwayh ⋯" [ref=e158] [cursor=pointer]:
                - button "⋮⋮" [ref=e159]
                - generic [ref=e160]: ▶
                - generic "Change icon" [ref=e161]: 📄
                - generic [ref=e162]: Calendar Test ms7iwayh
                - button "⋯" [ref=e163]
            - treeitem "⋮⋮ 📄 Calendar Test ms7iwye9 ⋯" [expanded] [level=1] [ref=e165]:
              - button "⋮⋮ 📄 Calendar Test ms7iwye9 ⋯" [ref=e166] [cursor=pointer]:
                - button "⋮⋮" [ref=e167]
                - generic [ref=e168]: ▶
                - generic "Change icon" [ref=e169]: 📄
                - generic [ref=e170]: Calendar Test ms7iwye9
                - button "⋯" [ref=e171]
            - treeitem "⋮⋮ 📄 Calendar Test ms7ixlrg ⋯" [expanded] [level=1] [ref=e173]:
              - button "⋮⋮ 📄 Calendar Test ms7ixlrg ⋯" [ref=e174] [cursor=pointer]:
                - button "⋮⋮" [ref=e175]
                - generic [ref=e176]: ▶
                - generic "Change icon" [ref=e177]: 📄
                - generic [ref=e178]: Calendar Test ms7ixlrg
                - button "⋯" [ref=e179]
            - treeitem "⋮⋮ 📄 Visual Regression ⋯" [expanded] [level=1] [ref=e181]:
              - button "⋮⋮ 📄 Visual Regression ⋯" [ref=e182] [cursor=pointer]:
                - button "⋮⋮" [ref=e183]
                - generic [ref=e184]: ▶
                - generic "Change icon" [ref=e185]: 📄
                - generic [ref=e186]: Visual Regression
                - button "⋯" [ref=e187]
        - generic [ref=e188]:
          - button "+ New page" [ref=e189] [cursor=pointer]:
            - generic [ref=e190]: +
            - text: New page
          - button "? Help" [ref=e191] [cursor=pointer]:
            - generic [ref=e192]: "?"
            - text: Help
        - generic "Resize sidebar" [ref=e193]
      - status [ref=e194]
      - generic [ref=e195]:
        - generic [ref=e196]:
          - generic [ref=e197]:
            - button "📄" [ref=e198] [cursor=pointer]
            - heading "Page Beta" [level=1] [ref=e199] [cursor=pointer]
            - button "☆" [ref=e200] [cursor=pointer]
            - button "⋯" [ref=e202] [cursor=pointer]
          - generic [ref=e205] [cursor=pointer]:
            - generic [ref=e206]: This page is empty
            - button "+ New block" [ref=e207]
          - button "▶ 0 backlinks" [ref=e209] [cursor=pointer]:
            - generic [ref=e210]: ▶
            - generic [ref=e211]: 0 backlinks
        - status [ref=e212]
    - generic:
      - contentinfo:
        - button "Open TanStack Router Devtools" [ref=e213] [cursor=pointer]:
          - generic [ref=e214]:
            - img [ref=e216]
            - img [ref=e251]
          - generic [ref=e285]: "-"
          - generic [ref=e286]: TanStack Router
  - region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  13  |  * page.evaluate() to click through them or interact with them directly.
  14  |  * Cookie consent is dismissed in auth setup, and the onboarding tour is
  15  |  * marked as completed via localStorage.
  16  |  */
  17  | 
  18  | /**
  19  |  * Click [data-new-page], then select "Blank page" from the template picker.
  20  |  */
  21  | async function createBlankPage(page: any) {
  22  | 	await page.evaluate(() => {
  23  | 		const btn = document.querySelector("[data-new-page]");
  24  | 		if (btn) (btn as HTMLElement).click();
  25  | 	});
  26  | 	const blankPage = page.getByText("Blank page");
  27  | 	await expect(blankPage).toBeVisible({ timeout: 5000 });
  28  | 	await blankPage.click();
  29  | 	await page.waitForTimeout(1000);
  30  | }
  31  | 
  32  | /**
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
> 113 | 		await expect(sidebar).toHaveScreenshot("sidebar-pages.png", {
      |                         ^ Error: expect(locator).toHaveScreenshot(expected) failed
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
  133 | 		await page.getByRole("button", { name: /database/i }).click();
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