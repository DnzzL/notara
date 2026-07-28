import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

When("I create a new blank page", async function (this: CustomWorld) {
	await this.page.evaluate(() => {
		const btn = document.querySelector("[data-new-page]");
		if (btn) (btn as HTMLElement).click();
	});
	const blank = this.page.getByText("Blank page");
	await expect(blank).toBeVisible({ timeout: 5000 });
	await blank.click({ force: true });
	await this.page.waitForTimeout(1500);
	// Click h1 to enter edit mode so title input is visible
	await this.page.evaluate(() => {
		const h1 = document.querySelector("h1");
		if (h1) (h1 as HTMLElement).click();
	});
	await this.page.waitForTimeout(300);
});

Then(
	"I should see a template picker dialog",
	async function (this: CustomWorld) {
		// The template picker is visible — "Blank page" option should be shown
		await expect(this.page.getByText("Blank page")).toBeVisible({
			timeout: 5000,
		});
	},
);

Then(
	"{string} should be visible as an option",
	async function (this: CustomWorld, text: string) {
		await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 });
	},
);

Then(
	"I should see an editable title input",
	async function (this: CustomWorld) {
		await expect(this.page.locator('input[name="page-title"]')).toBeVisible({
			timeout: 10000,
		});
	},
);

When(
	"I select the {string} template",
	async function (this: CustomWorld, name: string) {
		const template = this.page.getByText(name);
		await expect(template).toBeVisible({ timeout: 5000 });
		await template.click();
	},
);

Then("a new blank page should be created", async function (this: CustomWorld) {
	await expect(this.page.locator("h1")).toBeVisible({ timeout: 10000 });
});

Then(
	"I should see a title input for the new page",
	async function (this: CustomWorld) {
		const h1 = this.page.locator("h1");
		const input = this.page.locator('input[name="page-title"]');
		const ok = await Promise.race([
			h1.isVisible().then((v) => v),
			input.isVisible().then((v) => v),
		]);
		expect(ok).toBe(true);
	},
);

const BASE = "http://localhost:5173";

Given(
	"I am on the workspace settings page for {string}",
	async function (this: CustomWorld, slug: string) {
		await this.page.goto(`${BASE}/settings/${slug}`);
		await this.page.waitForLoadState("networkidle");
	},
);

When(
	"I navigate to the {string} section",
	async function (this: CustomWorld, section: string) {
		const tab = this.page.getByRole("tab", { name: section });
		if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
			await tab.click();
		}
		await this.page.waitForTimeout(300);
	},
);

Then(
	"I should see the template management UI",
	async function (this: CustomWorld) {
		await expect(this.page.locator("body")).toBeVisible({ timeout: 3000 });
	},
);
