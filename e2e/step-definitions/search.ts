import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

When("I open the search modal", async function (this: CustomWorld) {
	const searchTrigger = this.page.locator("[data-search-trigger]");
	// Try clicking the search shortcut or use Ctrl+K
	try {
		await searchTrigger.click({ timeout: 2000 });
	} catch {
		await this.page.keyboard.press("Control+k");
	}
	// Wait for the search modal to appear
	await this.page.waitForTimeout(500);
});

When(
	"I type {string} in the search input",
	async function (this: CustomWorld, query: string) {
		const searchInput = this.page.locator(
			'input[placeholder*="Search"], input[type="search"]',
		);
		await expect(searchInput).toBeVisible({ timeout: 3000 });
		await searchInput.fill(query);
	},
);

Then(
	"I should see {string} in the search results",
	async function (this: CustomWorld, text: string) {
		await expect(this.page.locator("body").getByText(text)).toBeVisible({
			timeout: 5000,
		});
	},
);
