import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

Given("I am on the workspace page", async function (this: CustomWorld) {
	// Already navigated to "/" in Before hook, and validated sidebar presence
});

When("I click the new page button", async function (this: CustomWorld) {
	await this.page.evaluate(() => {
		const btn = document.querySelector("[data-new-page]");
		if (btn) (btn as HTMLElement).click();
	});
});

When(
	"I click the {string} button",
	async function (this: CustomWorld, label: string) {
		const btn = this.page.getByRole("button", { name: label });
		await expect(btn).toBeVisible({ timeout: 5000 });
		await btn.click();
	},
);

When(
	"I type {string} as the page title",
	async function (this: CustomWorld, title: string) {
		// Click the h1 to enter edit mode, then fill the input
		await this.page.evaluate(() => {
			const h1 = document.querySelector("h1");
			if (h1) (h1 as HTMLElement).click();
		});
		await this.page.waitForTimeout(300);
		const input = this.page.locator('input[name="page-title"]');
		await expect(input).toBeVisible({ timeout: 10000 });
		await input.fill(title);
	},
);

When("I press Enter", async function (this: CustomWorld) {
	await this.page.locator('input[name="page-title"]').press("Enter");
});

Then(
	"I should see a page titled {string}",
	async function (this: CustomWorld, title: string) {
		const h1 = this.page.locator("h1");
		await expect(h1).toContainText(title, { timeout: 5000 });
	},
);
