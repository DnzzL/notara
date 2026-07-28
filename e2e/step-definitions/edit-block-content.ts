import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

Given(
	"I have a page titled {string}",
	async function (this: CustomWorld, title: string) {
		await this.page.locator("[data-new-page]").click();
		const input = this.page.locator('input[name="page-title"]');
		await expect(input).toBeVisible({ timeout: 5000 });
		await input.fill(title);
		await input.press("Enter");
	},
);

When("I focus the ProseMirror editor", async function (this: CustomWorld) {
	const editor = this.page.locator(".ProseMirror");
	await expect(editor).toBeVisible({ timeout: 5000 });
	await editor.click();
});

When("I type {string}", async function (this: CustomWorld, text: string) {
	const editor = this.page.locator(".ProseMirror");
	await editor.fill(text);
});

When(
	"I type {string} to open the slash menu",
	async function (this: CustomWorld, _slash: string) {
		const editor = this.page.locator(".ProseMirror");
		await editor.press("Home");
		await editor.press("/");

		// Wait for the slash menu to appear
		const slashMenu = this.page
			.locator('[class*="shadow-"]')
			.filter({ hasText: "Blocks" });
		await expect(slashMenu).toBeVisible({ timeout: 3000 });
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
