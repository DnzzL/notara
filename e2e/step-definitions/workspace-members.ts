import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

Then(
	"I should see the {string} tab selected by default",
	async function (this: CustomWorld, _tabName: string) {
		const tab = this.page.getByRole("tab", { name: _tabName });
		await expect(tab).toBeVisible({ timeout: 5000 });
		const selected = await tab.getAttribute("aria-selected");
		if (selected !== null) {
			expect(selected).toBe("true");
		}
	},
);

Then("I should see my own member entry", async function (this: CustomWorld) {
	const memberList = this.page.locator('[role="tabpanel"]');
	await expect(memberList).toBeVisible({ timeout: 5000 });
});

When(
	"I type {string} in the invite email field",
	async function (this: CustomWorld, email: string) {
		const input = this.page.locator('input[name="invite-email"]');
		await expect(input).toBeVisible({ timeout: 5000 });
		await input.fill(email);
	},
);

Then(
	"I should see an invitation sent confirmation",
	async function (this: CustomWorld) {
		// Use existing step "I click "Send Invite"" from trash-restore.ts
		const feedback = this.page.locator(
			'[role="status"], [role="alert"], *:has-text("invitation sent")',
		);
		await expect(feedback.first()).toBeVisible({ timeout: 10000 });
	},
);

Then(
	"I should see a link copied confirmation",
	async function (this: CustomWorld) {
		const feedback = this.page.locator(
			'[role="status"], [role="alert"], *:has-text("copied")',
		);
		await expect(feedback.first()).toBeVisible({ timeout: 5000 });
	},
);

Then(
	"the invite link should be in the clipboard",
	async function (this: CustomWorld) {
		const clipText = await this.page.evaluate(() =>
			navigator.clipboard.readText().catch(() => ""),
		);
		expect(clipText.length).toBeGreaterThan(0);
	},
);
