# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: database-views.spec.ts >> Database Views >> CR-2: Month navigation prev/next
- Location: e2e/database-views.spec.ts:106:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[role="tab"]').filter({ hasText: 'Calendar' })
    - locator resolved to <button role="tab" aria-selected="false" class="bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px] text-text-3">Calendar</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="fixed inset-0 bg-[rgba(15,18,30,0.3)] backdrop-blur-[4px] z-[9000] flex justify-end [animation:fade-in_0.14s_var(--ease)]">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="fixed inset-0 bg-[rgba(15,18,30,0.3)] backdrop-blur-[4px] z-[9000] flex justify-end [animation:fade-in_0.14s_var(--ease)]">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    56 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div class="fixed inset-0 bg-[rgba(15,18,30,0.3)] backdrop-blur-[4px] z-[9000] flex justify-end [animation:fade-in_0.14s_var(--ease)]">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms

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
            - treeitem "⋮⋮ 📄 Calendar Test ms7iwye9 ⋯" [expanded] [level=1] [selected] [ref=e21]:
              - button "⋮⋮ 📄 Calendar Test ms7iwye9 ⋯" [ref=e22] [cursor=pointer]:
                - button "⋮⋮" [ref=e23]
                - generic [ref=e24]: ▶
                - generic "Change icon" [ref=e25]: 📄
                - generic [ref=e26]: Calendar Test ms7iwye9
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
        - generic [ref=e156]:
          - button "+ New page" [ref=e157] [cursor=pointer]:
            - generic [ref=e158]: +
            - text: New page
          - button "? Help" [ref=e159] [cursor=pointer]:
            - generic [ref=e160]: "?"
            - text: Help
        - generic "Resize sidebar" [ref=e161]
      - status [ref=e162]
      - generic [ref=e163]:
        - generic [ref=e164]:
          - generic [ref=e165]:
            - button "📄" [ref=e166] [cursor=pointer]
            - heading "Calendar Test ms7iwye9" [level=1] [ref=e167] [cursor=pointer]
            - button "☆" [ref=e168] [cursor=pointer]
            - button "⋯" [ref=e170] [cursor=pointer]
          - generic [ref=e171]:
            - generic [ref=e173]:
              - generic:
                - button "+"
                - button "Click for options, drag to reorder":
                  - generic "Drag to reorder":
                    - img
              - textbox [ref=e178]:
                - paragraph [ref=e179]: Type '/' for commands
            - button "+ New block" [ref=e180] [cursor=pointer]:
              - generic [ref=e181]: +
              - generic [ref=e182]: New block
            - generic [ref=e184]:
              - generic [ref=e185]:
                - button "+" [ref=e186] [cursor=pointer]
                - button "Click for options, drag to reorder" [ref=e187]:
                  - generic "Drag to reorder" [ref=e188]:
                    - img [ref=e189]
              - generic [ref=e196]:
                - generic [ref=e197]:
                  - generic [ref=e198]:
                    - button "Grid" [ref=e200] [cursor=pointer]:
                      - img [ref=e201]
                      - generic [ref=e206]: Grid
                      - img [ref=e207]
                    - tablist [ref=e209]:
                      - tab "Table" [selected] [ref=e210] [cursor=pointer]
                      - tab "Board" [ref=e211] [cursor=pointer]
                      - tab "Calendar" [ref=e212] [cursor=pointer]
                    - generic [ref=e213]:
                      - button "Filter" [ref=e214] [cursor=pointer]:
                        - img [ref=e215]
                        - text: Filter
                      - button "Sort" [ref=e217] [cursor=pointer]:
                        - img [ref=e218]
                        - text: Sort
                    - generic [ref=e221] [cursor=pointer]: Untitled
                  - table [ref=e223]:
                    - rowgroup [ref=e224]:
                      - row "🌐 Name ⋮⋮ Aa Notes ▼ +" [ref=e225]:
                        - columnheader [ref=e226]
                        - columnheader "🌐 Name" [ref=e227]:
                          - generic [ref=e228] [cursor=pointer]:
                            - generic [ref=e229]: 🌐
                            - generic [ref=e230]: Name
                        - columnheader "⋮⋮ Aa Notes ▼" [ref=e232]:
                          - button "⋮⋮" [ref=e233]
                          - generic [ref=e234] [cursor=pointer]:
                            - generic [ref=e235]: Aa
                            - generic [ref=e236]: Notes
                            - generic [ref=e237]: ▼
                        - columnheader "+" [ref=e239]:
                          - button "+" [ref=e240] [cursor=pointer]
                    - rowgroup [ref=e241]:
                      - row "Select row (Shift+click for range) ⋮⋮ ↗ × Untitled" [ref=e242]:
                        - cell "Select row (Shift+click for range) ⋮⋮ ↗ ×" [ref=e243]:
                          - checkbox "Select row (Shift+click for range)" [ref=e244] [cursor=pointer]
                          - button "⋮⋮" [ref=e245]
                          - button "↗" [ref=e246] [cursor=pointer]
                          - button "×" [ref=e247] [cursor=pointer]
                        - cell "Untitled" [ref=e248]:
                          - generic [ref=e249]: Untitled
                        - cell [ref=e250]
                        - cell [ref=e252]
                      - row "+ New record" [ref=e253]:
                        - cell "+ New record" [ref=e254]:
                          - button "+ New record" [active] [ref=e255] [cursor=pointer]
                    - rowgroup [ref=e256]:
                      - row "Calculate Calculate Calculate Calculate" [ref=e257]:
                        - cell [ref=e258]
                        - cell "Calculate Calculate" [ref=e259]:
                          - generic [ref=e260]:
                            - generic [ref=e261]: Calculate
                            - combobox "Summary" [ref=e262] [cursor=pointer]:
                              - option "Calculate" [selected]
                              - option "Count all"
                              - option "Count values"
                              - option "Count empty"
                        - cell "Calculate Calculate" [ref=e263]:
                          - generic [ref=e264]:
                            - generic [ref=e265]: Calculate
                            - combobox "Summary" [ref=e266] [cursor=pointer]:
                              - option "Calculate" [selected]
                              - option "Count all"
                              - option "Count values"
                              - option "Count empty"
                        - cell [ref=e267]
                  - dialog "Record details" [ref=e269]:
                    - banner [ref=e270]:
                      - button "Close" [ref=e271] [cursor=pointer]: ×
                    - textbox "Untitled" [ref=e272]
                    - button "↗ Open as page" [ref=e273] [cursor=pointer]
                    - generic [ref=e276]: Notes
                - status [ref=e279]
          - button "▶ 0 backlinks" [ref=e281] [cursor=pointer]:
            - generic [ref=e282]: ▶
            - generic [ref=e283]: 0 backlinks
        - status [ref=e284]
    - generic:
      - contentinfo:
        - button "Open TanStack Router Devtools" [ref=e285] [cursor=pointer]:
          - generic [ref=e286]:
            - img [ref=e288]
            - img [ref=e323]
          - generic [ref=e357]: "-"
          - generic [ref=e358]: TanStack Router
  - region "Notifications, bottom-end (alt+T)"
```

# Test source

```ts
  13  | 
  14  | test.describe("Database Views", () => {
  15  | 	test.beforeEach(async ({ page }) => {
  16  | 		await gotoApp(page);
  17  | 	});
  18  | 
  19  | 	/**
  20  | 	 * Helper: create a page with a database that has a Date field, then add
  21  | 	 * records so the Calendar view is meaningful.
  22  | 	 */
  23  | 	const createDatabaseWithDateField = async (page: any) => {
  24  | 		const editor = await createPage(
  25  | 			page,
  26  | 			`Calendar Test ${Date.now().toString(36)}`,
  27  | 		);
  28  | 
  29  | 		// Open slash menu and insert Database
  30  | 		await openSlashMenu(page, editor);
  31  | 		await page.locator("button").filter({ hasText: "Database" }).click();
  32  | 
  33  | 		// Wait for the database table to render
  34  | 		await page
  35  | 			.locator("table.w-full")
  36  | 			.waitFor({ state: "visible", timeout: 10000 });
  37  | 
  38  | 		// Add a Date field via the "+" add-property button
  39  | 		const addFieldBtn = page.locator('button[title="Add property"]');
  40  | 		await addFieldBtn.click();
  41  | 
  42  | 		// Look for the AddFieldPopover — it has a type selector and name input
  43  | 		const fieldNameInput = page.locator('input[placeholder="Field name"]');
  44  | 		if (await fieldNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
  45  | 			await fieldNameInput.fill("Event Date");
  46  | 			// Change type to "date" — there's a type selector somewhere in the popover
  47  | 			const typeSelect = page
  48  | 				.locator("select")
  49  | 				.filter({ hasText: /text|number|select/i })
  50  | 				.first();
  51  | 			if (await typeSelect.isVisible()) {
  52  | 				await typeSelect.selectOption("date");
  53  | 			}
  54  | 			await fieldNameInput.blur();
  55  | 		}
  56  | 
  57  | 		// Add a record via the "+ New record" button
  58  | 		const newRecordBtn = page.getByText("+ New record");
  59  | 		await newRecordBtn.click();
  60  | 
  61  | 		// If a record panel opens, fill the title
  62  | 		const recordTitleInput = page.locator('input[name="record-title"]');
  63  | 		if (
  64  | 			await recordTitleInput.isVisible({ timeout: 3000 }).catch(() => false)
  65  | 		) {
  66  | 			await recordTitleInput.fill("Test Event");
  67  | 			await recordTitleInput.press("Enter");
  68  | 		}
  69  | 	};
  70  | 
  71  | 	test("CR-1: Board → Calendar switching persists (does not revert to Board)", async ({
  72  | 		page,
  73  | 	}) => {
  74  | 		await createDatabaseWithDateField(page);
  75  | 
  76  | 		// Switch to Board view
  77  | 		const boardTab = page.locator('[role="tab"]').filter({ hasText: "Board" });
  78  | 		await boardTab.click();
  79  | 		await page.waitForTimeout(500);
  80  | 
  81  | 		// Verify Board is active
  82  | 		let activeTab = page.locator('[role="tab"][aria-selected="true"]');
  83  | 		await expect(activeTab).toContainText("Board");
  84  | 
  85  | 		// Switch to Calendar view
  86  | 		const calendarTab = page
  87  | 			.locator('[role="tab"]')
  88  | 			.filter({ hasText: "Calendar" });
  89  | 		await calendarTab.click();
  90  | 		await page.waitForTimeout(500);
  91  | 
  92  | 		// Verify Calendar is now active
  93  | 		activeTab = page.locator('[role="tab"][aria-selected="true"]');
  94  | 		await expect(activeTab).toContainText("Calendar");
  95  | 
  96  | 		// Switch back to Board, then to Calendar again to ensure consistency
  97  | 		await boardTab.click();
  98  | 		await page.waitForTimeout(500);
  99  | 		await calendarTab.click();
  100 | 		await page.waitForTimeout(500);
  101 | 
  102 | 		activeTab = page.locator('[role="tab"][aria-selected="true"]');
  103 | 		await expect(activeTab).toContainText("Calendar");
  104 | 	});
  105 | 
  106 | 	test("CR-2: Month navigation prev/next", async ({ page }) => {
  107 | 		await createDatabaseWithDateField(page);
  108 | 
  109 | 		// Switch to Calendar view
  110 | 		const calendarTab = page
  111 | 			.locator('[role="tab"]')
  112 | 			.filter({ hasText: "Calendar" });
> 113 | 		await calendarTab.click();
      |                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
  114 | 		await page.waitForTimeout(1000);
  115 | 
  116 | 		// The Calendar view shows the current month in a header (e.g. "June 2026")
  117 | 		// and prev/next buttons with "‹" and "›" text
  118 | 		const monthLabel = page.locator("text=June|July|August|January").first();
  119 | 
  120 | 		// If the calendar has no date field, it shows a message — skip if so
  121 | 		const noDateFieldMsg = page.getByText(
  122 | 			"Add a Date field to use the calendar view",
  123 | 		);
  124 | 		if (await noDateFieldMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
  125 | 			test.skip();
  126 | 			return;
  127 | 		}
  128 | 
  129 | 		// Capture the current month text
  130 | 		const currentMonthText = await monthLabel.textContent();
  131 | 
  132 | 		// Click "next" (›) button
  133 | 		const nextBtn = page.locator("button").filter({ hasText: "›" });
  134 | 		await nextBtn.click();
  135 | 		await page.waitForTimeout(500);
  136 | 
  137 | 		// The month label should have changed
  138 | 		const newMonthText = await monthLabel.textContent();
  139 | 		expect(newMonthText).not.toBe(currentMonthText);
  140 | 
  141 | 		// Click "prev" (‹) button twice to go back one month
  142 | 		const prevBtn = page.locator("button").filter({ hasText: "‹" });
  143 | 		await prevBtn.click();
  144 | 		await page.waitForTimeout(500);
  145 | 		await prevBtn.click();
  146 | 		await page.waitForTimeout(500);
  147 | 
  148 | 		// We should be one month before the original
  149 | 		const finalMonthText = await monthLabel.textContent();
  150 | 		expect(finalMonthText).not.toBe(newMonthText);
  151 | 	});
  152 | 
  153 | 	test("CR-3: '+' on a day creates a record dialog", async ({ page }) => {
  154 | 		await createDatabaseWithDateField(page);
  155 | 
  156 | 		// Switch to Calendar view
  157 | 		const calendarTab = page
  158 | 			.locator('[role="tab"]')
  159 | 			.filter({ hasText: "Calendar" });
  160 | 		await calendarTab.click();
  161 | 		await page.waitForTimeout(1000);
  162 | 
  163 | 		// If the calendar has no date field, skip
  164 | 		const noDateFieldMsg = page.getByText(
  165 | 			"Add a Date field to use the calendar view",
  166 | 		);
  167 | 		if (await noDateFieldMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
  168 | 			test.skip();
  169 | 			return;
  170 | 		}
  171 | 
  172 | 		// Click the "+" button on a day cell — it appears on hover
  173 | 		// Each day cell has a "+" button with title "Add record"
  174 | 		const addRecordBtn = page.locator('button[title="Add record"]').first();
  175 | 		await addRecordBtn.click();
  176 | 		await page.waitForTimeout(500);
  177 | 
  178 | 		// A dialog (DialogRoot) should appear with a record title input
  179 | 		const dialogInput = page.locator('input[name="new-record-title"]');
  180 | 		await expect(dialogInput).toBeVisible({ timeout: 5000 });
  181 | 
  182 | 		// Fill in a title and click Create
  183 | 		await dialogInput.fill("Calendar Created Event");
  184 | 		await page.locator("button").filter({ hasText: "Create" }).click();
  185 | 		await page.waitForTimeout(1000);
  186 | 
  187 | 		// The dialog should close and the record should appear on the calendar
  188 | 		// The calendar grid shows record titles inside button elements
  189 | 		const recordEntry = page
  190 | 			.locator("button")
  191 | 			.filter({ hasText: "Calendar Created Event" });
  192 | 		await expect(recordEntry).toBeVisible({ timeout: 5000 });
  193 | 	});
  194 | });
  195 | 
```