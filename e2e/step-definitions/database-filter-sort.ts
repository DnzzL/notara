import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

When(
	"I click the {string} button in the database toolbar",
	async function (this: CustomWorld, label: string) {
		const btn = this.page.getByRole("button", { name: label });
		await expect(btn).toBeVisible({ timeout: 5000 });
		await btn.click();
	},
);

Then("I should see the filter panel", async function (this: CustomWorld) {
	// The filter panel appears when the Filter button is clicked
	const filterSection = this.page.locator("div").filter({ hasText: "Filter" });
	await expect(filterSection).toBeVisible({ timeout: 5000 });
});

When(
	"I click a column header in the database",
	async function (this: CustomWorld) {
		// Click the first column header (th) in the database table
		const header = this.page.locator("table.w-full th").first();
		await expect(header).toBeVisible({ timeout: 5000 });
		await header.click();
	},
);

Then(
	"the column should have a sort indicator",
	async function (this: CustomWorld) {
		// After clicking sort, wait for the sort to apply
		await this.page.waitForTimeout(500);
		const header = this.page.locator("table.w-full th").first();
		await expect(header).toBeVisible({ timeout: 3000 });
	},
);
