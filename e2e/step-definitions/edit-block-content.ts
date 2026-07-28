import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

Given(
	"I have a page titled {string}",
	async function (this: CustomWorld, title: string) {
		// Click new page button — opens template picker
		await this.page.evaluate(() => {
			const btn = document.querySelector("[data-new-page]");
			if (btn) (btn as HTMLElement).click();
		});
		// Select Blank page from template picker
		const blank = this.page.getByText("Blank page");
		await expect(blank).toBeVisible({ timeout: 5000 });
		await blank.click({ force: true });
		await this.page.waitForTimeout(1500);
		// Title is rendered as h1 (view mode); click it to enter edit mode
		await this.page.evaluate(() => {
			const h1 = document.querySelector("h1");
			if (h1) (h1 as HTMLElement).click();
		});
		await this.page.waitForTimeout(300);
		// Now the title input should be visible
		const input = this.page.locator('input[name="page-title"]');
		await expect(input).toBeVisible({ timeout: 10000 });
		await input.fill(title);
		await input.press("Enter");
	},
);

When("I focus the ProseMirror editor", async function (this: CustomWorld) {
	// Handle empty page state — click "This page is empty" to create first block
	const emptyState = this.page.getByText("This page is empty");
	if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
		await emptyState.click();
	}
	const editor = this.page.locator(".ProseMirror");
	await expect(editor).toBeVisible({ timeout: 10000 });
	await editor.click();
});

When("I type {string}", async function (this: CustomWorld, text: string) {
	const emptyState = this.page.getByText("This page is empty");
	if (await emptyState.isVisible({ timeout: 1000 }).catch(() => false)) {
		await emptyState.click();
	}
	const editor = this.page.locator(".ProseMirror");
	await expect(editor).toBeVisible({ timeout: 10000 });
	await editor.fill(text);
});

When(
	"I type {string} to open the slash menu",
	async function (this: CustomWorld, _slash: string) {
		const emptyState = this.page.getByText("This page is empty");
		if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
			await emptyState.click();
		}
		const editor = this.page.locator(".ProseMirror");
		await expect(editor).toBeVisible({ timeout: 10000 });
		await editor.click();
		await editor.press("Home");
		await editor.press("/");

		// Wait for the slash menu heading
		await expect(this.page.getByText("Blocks")).toBeVisible({ timeout: 3000 });
	},
);

When(
	"I click the {string} option",
	async function (this: CustomWorld, option: string) {
		await this.page.locator("button").filter({ hasText: option }).click();
	},
);

Then(
	"the editor should contain {string}",
	async function (this: CustomWorld, text: string) {
		const editor = this.page.locator(".ProseMirror");
		await expect(editor).toContainText(text, { timeout: 3000 });
	},
);

Then("I should see a database table", async function (this: CustomWorld) {
	const dbTable = this.page.locator("table.w-full");
	await expect(dbTable).toBeVisible({ timeout: 10000 });
});

Then(
	"I should see the view switcher toolbar",
	async function (this: CustomWorld) {
		const viewTabs = this.page.locator('[role="tablist"]');
		await expect(viewTabs).toBeVisible({ timeout: 5000 });
	},
);
