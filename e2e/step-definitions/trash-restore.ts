import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

When("I open the page menu", async function (this: CustomWorld) {
	const menuBtn = this.page.locator('button[title="More actions"]');
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
		// Create a page via template picker
		await this.page.evaluate(() => {
			const btn = document.querySelector("[data-new-page]");
			if (btn) (btn as HTMLElement).click();
		});
		const blank = this.page.getByText("Blank page");
		await expect(blank).toBeVisible({ timeout: 5000 });
		await blank.click({ force: true });
		await this.page.waitForTimeout(1500);
		// Click h1 to enter edit mode, then set title
		await this.page.evaluate(() => {
			const h1 = document.querySelector("h1");
			if (h1) (h1 as HTMLElement).click();
		});
		await this.page.waitForTimeout(300);
		await this.page.locator('input[name="page-title"]').fill(title);
		await this.page.locator('input[name="page-title"]').press("Enter");
		await this.page.waitForTimeout(500);

		// Open the page menu ("⋯" button) and delete
		const menuBtn = this.page.locator('button[title="More actions"]');
		await expect(menuBtn).toBeVisible({ timeout: 5000 });
		await menuBtn.click();
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
