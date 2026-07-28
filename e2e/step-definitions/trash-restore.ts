import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

When("I open the page menu", async function (this: CustomWorld) {
	const menuBtn = this.page.locator("[data-page-menu]");
	await expect(menuBtn).toBeVisible({ timeout: 5000 });
	await menuBtn.click();
});

When("I click {string}", async function (this: CustomWorld, label: string) {
	await this.page.getByRole("button", { name: label }).click();
});

Then(
	"the page should no longer appear in the sidebar",
	async function (this: CustomWorld) {
		const sidebar = this.page.locator("[data-sidebar]");
		await expect(sidebar).not.toContainText("Page to Trash", { timeout: 5000 });
	},
);

Given(
	"I have trashed a page titled {string}",
	async function (this: CustomWorld, title: string) {
		// Create and immediately delete the page
		await this.page.locator("[data-new-page]").click();
		await this.page.locator('input[name="page-title"]').fill(title);
		await this.page.locator('input[name="page-title"]').press("Enter");
		await this.page.waitForTimeout(200);

		// Open the menu and delete
		await this.page.locator("[data-page-menu]").click();
		await this.page.getByRole("button", { name: "Delete" }).click();
	},
);

When("I open the trash modal", async function (this: CustomWorld) {
	const trashBtn = this.page.locator("[data-trash-trigger]");
	await expect(trashBtn).toBeVisible({ timeout: 5000 });
	await trashBtn.click();
});

When(
	"I click {string} on the trashed page",
	async function (this: CustomWorld, action: string) {
		const restoreBtn = this.page
			.getByRole("button")
			.filter({ hasText: action });
		await expect(restoreBtn).toBeVisible({ timeout: 3000 });
		await restoreBtn.click();
	},
);

Then(
	"the page should reappear in the sidebar",
	async function (this: CustomWorld) {
		const sidebar = this.page.locator("[data-sidebar]");
		await expect(sidebar).toContainText("Page to Restore", { timeout: 5000 });
	},
);
