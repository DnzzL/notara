import { expect, test } from "@playwright/test";
import {
	createPage,
	gotoApp,
	openSlashMenu,
	runSlashCommand,
	slashMenu,
} from "./helpers.js";

/**
 * Block Types via Slash Menu
 *
 * The slash menu is deliberately slim: it only carries block types that cannot
 * be produced by typing. Headings, quotes, todos and code blocks are markdown
 * input rules (`# `, `> `, `- [] `, ```` ``` ````), not menu entries — an earlier
 * version of this spec drove them through the menu and could never have passed.
 *
 * Commands split into three shapes, which is what these tests cover:
 *   - in-place: the current block's content is replaced (Callout, Toggle)
 *   - new block: a sibling block is appended (Divider)
 *   - picker: a block is appended that opens its own picker (Link to page,
 *     People, View reference) — the picker is asserted, not driven
 * Image and File open a native file dialog, so they are not covered here.
 */

/** Every command the menu offers, in render order. */
const COMMANDS = [
	"Image",
	"File",
	"Divider",
	"Callout",
	"Toggle",
	"Database",
	"Link to page",
	"People",
	"View reference",
];

test.describe("Block Types via Slash Menu", () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	const editorHtml = (page: any) =>
		page
			.locator(".ProseMirror")
			.first()
			.evaluate((el: HTMLElement) => el.innerHTML);

	test("slash menu lists exactly the supported commands", async ({ page }) => {
		await createPage(page, "Menu List");
		const menu = await openSlashMenu(page);

		await expect(menu.getByRole("button")).toHaveCount(COMMANDS.length);
		for (const name of COMMANDS) {
			await expect(
				menu.getByRole("button").filter({ hasText: name }),
			).toBeVisible();
		}
	});

	test("slash menu filters by query", async ({ page }) => {
		const editor = await createPage(page, "Filter");
		const menu = await openSlashMenu(page, editor);

		await editor.pressSequentially("tog");

		// "tog" matches Toggle only.
		await expect(menu.getByRole("button")).toHaveCount(1);
		await expect(menu.getByRole("button").first()).toContainText("Toggle");
	});

	test("filtering to nothing closes the menu", async ({ page }) => {
		const editor = await createPage(page, "NoMatch");
		await openSlashMenu(page, editor);

		await editor.pressSequentially("zzzz");

		// The menu unmounts when no command matches.
		await expect(slashMenu(page)).toBeHidden({ timeout: 5000 });
	});

	test("Callout replaces the current block in place", async ({ page }) => {
		const editor = await createPage(page, "Callout");
		await openSlashMenu(page, editor);
		await runSlashCommand(page, "Callout");

		await expect
			.poll(() => editorHtml(page), { timeout: 10000 })
			.toContain("data-callout");
	});

	test("Toggle replaces the current block in place", async ({ page }) => {
		const editor = await createPage(page, "Toggle");
		await openSlashMenu(page, editor);
		await runSlashCommand(page, "Toggle");

		// The details/summary source content is rendered by TipTap as a
		// div.toggle-block wrapper — there is no <details> element in the DOM.
		await expect
			.poll(() => editorHtml(page), { timeout: 10000 })
			.toContain("toggle-block");
		expect(await editorHtml(page)).toContain("<summary");
	});

	test("Divider appends a divider block", async ({ page }) => {
		const editor = await createPage(page, "Divider");
		await openSlashMenu(page, editor);
		await runSlashCommand(page, "Divider");

		// Divider renders outside TipTap as its own block, not inside the editor.
		await expect(page.locator("hr.block-divider")).toBeVisible({
			timeout: 10000,
		});
	});

	test("Link to page appends a block that opens a page picker", async ({
		page,
	}) => {
		const editor = await createPage(page, "PageLink");
		await openSlashMenu(page, editor);
		await runSlashCommand(page, "Link to page");

		// The new pageLink block auto-opens its picker because it has no target.
		await expect(page.getByPlaceholder(/search|page/i).first()).toBeVisible({
			timeout: 10000,
		});
	});
});
