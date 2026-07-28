import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

const BASE = "http://localhost:5173";

Then("I should see an import dialog", async function (this: CustomWorld) {
	const dialog = this.page.locator('[role="dialog"]');
	await expect(dialog).toBeVisible({ timeout: 5000 });
});

Given("I open the import dialog", async function (this: CustomWorld) {
	// Navigate to settings page and find import section
	await this.page.goto(`${BASE}/settings/e2e`);
	await this.page.waitForLoadState("networkidle");

	// Click the "Import / Export" or "Import" tab/button
	const importTab = this.page.getByRole("tab", { name: /import/i });
	if (await importTab.isVisible({ timeout: 3000 }).catch(() => false)) {
		await importTab.click();
	}

	// Wait for the import content area
	await this.page.waitForTimeout(500);
});

Then(
	"I should see {string} or a file upload area",
	async function (this: CustomWorld, _text: string) {
		// Look for any import-related UI (file input, file upload area, or text)
		const importArea = this.page.locator(
			'input[type="file"], [role="dialog"], text=Import',
		);
		await expect(importArea.first()).toBeVisible({ timeout: 5000 });
	},
);

When(
	"I click {string} without selecting a file",
	async function (this: CustomWorld, label: string) {
		const btn = this.page.getByRole("button", { name: label });
		await expect(btn).toBeVisible({ timeout: 5000 });
		await btn.click();
	},
);

Then(
	"I should see a validation message about selecting a file",
	async function (this: CustomWorld) {
		// Expect some form of validation feedback
		const feedback = this.page.locator(
			'text=select a file, text=choose a file, text=required, [role="alert"]',
		);
		await expect(feedback.first()).toBeVisible({ timeout: 5000 });
	},
);
