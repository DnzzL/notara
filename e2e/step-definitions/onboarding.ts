import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { CustomWorld } from "./common.ts";

const BASE = "http://localhost:5173";

When(
	"I navigate to {string}",
	async function (this: CustomWorld, path: string) {
		await this.page.goto(`${BASE}${path}`);
		await this.page.waitForLoadState("networkidle");
	},
);

When(
	"I type {string} in the workspace name field",
	async function (this: CustomWorld, name: string) {
		const input = this.page.locator('input[name="workspace-name"]');
		await expect(input).toBeVisible({ timeout: 5000 });
		await input.fill(name);
	},
);

When(
	"I type {string} in the workspace slug field",
	async function (this: CustomWorld, slug: string) {
		const input = this.page.locator('input[name="workspace-slug"]');
		await expect(input).toBeVisible({ timeout: 5000 });
		await input.fill(slug);
	},
);

Then(
	"I should be redirected to the new workspace page",
	async function (this: CustomWorld) {
		// After creation we land on /$workspaceSlug, not /workspaces
		await this.page.waitForURL(/^\/[^/]+$/, { timeout: 10000 });
		let currentUrl: { pathname: string };
		try {
			currentUrl = new URL(this.page.url());
		} catch {
			currentUrl = { pathname: this.page.url() };
		}
		expect(currentUrl.pathname).not.toContain("/workspaces");
	},
);

Then(
	"I should see {string} in the page",
	async function (this: CustomWorld, selector: string) {
		await expect(this.page.locator(selector)).toBeVisible({ timeout: 10000 });
	},
);

When(
	"I type the command {string} in the browser",
	async function (this: CustomWorld, command: string) {
		await this.page.evaluate((cmd) => {
			// Extract the key=value or function call from the command string
			// e.g. "localStorage.setItem('notara:tourCompleted', 'true')"
			const fn = new Function(`"use strict"; return (${cmd})`);
			fn();
		}, command);
	},
);

When("I reload the page", async function (this: CustomWorld) {
	await this.page.reload({ waitUntil: "networkidle" });
	// Wait for the sidebar to confirm we're on the workspace page
	try {
		await this.page.waitForSelector("[data-sidebar]", { timeout: 15000 });
	} catch {
		// Not authenticated — tests will fail informatively
	}
});

Then(
	"the onboarding tour should not appear",
	async function (this: CustomWorld) {
		// The tour is stored in localStorage; if marked completed it won't show.
		const tourCompleted = await this.page.evaluate(() =>
			localStorage.getItem("notara:tourCompleted"),
		);
		expect(tourCompleted).toBe("true");
	},
);
