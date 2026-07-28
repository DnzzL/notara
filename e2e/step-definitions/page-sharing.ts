import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

When("I click the page menu button", async function (this: CustomWorld) {
	// The page menu is a "⋯" button in the page header area
	const menuBtn = this.page.locator('button[title="More actions"]');
	await expect(menuBtn).toBeVisible({ timeout: 5000 });
	await menuBtn.click();
});

When(
	"I click {string} in the menu",
	async function (this: CustomWorld, label: string) {
		// Click a menu item label (case-insensitive) from the open dropdown
		const menuItem = this.page
			.locator("div")
			.filter({ hasText: label })
			.locator("button")
			.first();
		await expect(menuItem).toBeVisible({ timeout: 3000 });
		await menuItem.click();
	},
);

Then("I should see a share dialog", async function (this: CustomWorld) {
	const dialog = this.page.locator('[role="dialog"]');
	await expect(dialog).toBeVisible({ timeout: 5000 });
});

Then(
	"I should see {string} as the dialog title",
	async function (this: CustomWorld, title: string) {
		const dialog = this.page.locator('[role="dialog"]');
		await expect(dialog).toContainText(title, { timeout: 3000 });
	},
);

Given(
	"I open the share dialog for the current page",
	async function (this: CustomWorld) {
		const menuBtn = this.page.locator('button[title="More actions"]');
		await expect(menuBtn).toBeVisible({ timeout: 5000 });
		await menuBtn.click();
		const shareBtn = this.page.getByRole("button", { name: /share/i });
		await expect(shareBtn).toBeVisible({ timeout: 3000 });
		await shareBtn.click();
		const dialog = this.page.locator('[role="dialog"]');
		await expect(dialog).toBeVisible({ timeout: 5000 });
	},
);

When(
	"I select {string} from the relation dropdown",
	async function (this: CustomWorld, _relation: string) {
		// Select an existing member's relation role (viewer/editor/owner)
		// This finds a relation toggle button inside the share dialog
		const btn = this.page
			.locator('[role="dialog"]')
			.getByRole("button", { name: _relation });
		await expect(btn).toBeVisible({ timeout: 3000 });
		await btn.click();
	},
);

Then(
	"the page should have an editor ACL applied",
	async function (this: CustomWorld) {
		// Verify the share dialog reflects the change
		const dialog = this.page.locator('[role="dialog"]');
		await expect(dialog).toContainText("can edit", { timeout: 3000 });
	},
);
