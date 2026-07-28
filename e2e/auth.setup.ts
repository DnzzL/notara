import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "playwright/.auth/user.json";

/**
 * Auth setup: signs up a fresh test user via the UI, creates a workspace,
 * then saves the authenticated storage state so downstream tests can skip
 * the login + workspace-creation flow.
 *
 * Uses a timestamp-based email to avoid collisions across runs.
 */
setup("authenticate as test user", async ({ page }) => {
	const ts = Date.now();
	const email = `e2e-test-${ts}@example.com`;
	const password = "TestPassword123!";
	const name = "E2E Tester";

	// Navigate directly to /login — the landing page is public
	await page.goto("/login");

	// Dismiss the cookie consent banner so it doesn't block clicks
	try {
		const consent = page.getByRole("dialog", { name: "Cookie consent" });
		await consent
			.getByLabel("Accept analytics cookies")
			.click({ timeout: 3000 });
	} catch {
		// Banner already dismissed or not shown
	}

	// Mark the onboarding tour as completed so it doesn't auto-start
	// and block interactions in the workspace page.
	await page.evaluate(() =>
		localStorage.setItem("notara:tourCompleted", "true"),
	);

	// Switch to registration mode
	const createAccountBtn = page.getByText("Create an account");
	if (await createAccountBtn.isVisible()) {
		await createAccountBtn.click();
	}

	// Fill registration form — inputs identified by type= attribute
	const nameInput = page.locator('input[type="text"]');
	const emailInput = page.locator('input[type="email"]');
	const passwordInput = page.locator('input[type="password"]');

	if (await nameInput.isVisible()) {
		await nameInput.fill(name);
	}
	await emailInput.fill(email);
	await passwordInput.fill(password);

	// Submit
	await page.getByRole("button", { name: /create account/i }).click();

	// Wait for redirect after signup. Without SMTP configured, Better Auth
	// skips email verification and redirects straight to /workspaces.
	try {
		await page.waitForURL(/\/workspaces/, { timeout: 10000 });
	} catch {
		const u = page.url();
		if (u.includes("verify") || u.includes("confirm")) {
			console.log("⚠ Email verification required — auth setup incomplete");
			return;
		}
		await page.screenshot({ path: "test-results/auth-failed.png" });
		throw new Error(`Signup did not redirect to /workspaces. Current: ${u}`);
	}

	// Verify the session cookie is present
	await expect(async () => {
		const cookies = await page.context().cookies();
		const sessionCookie = cookies.find(
			(c) => c.name === "better-auth.session_token",
		);
		expect(sessionCookie).toBeTruthy();
	}).toPass({ timeout: 5000 });

	// Create a workspace so downstream tests have a page to land on.
	// Only if we're on the bare /workspaces list (not already inside one).
	const url = page.url();
	const isWorkspacesList =
		url.includes("/workspaces") && url.match(/\/workspaces\/?$/);

	if (isWorkspacesList) {
		// Wait for the workspaces list to finish loading
		await page.waitForSelector("text=Your workspaces", { timeout: 10000 });

		const newWsBtn = page.getByRole("button", { name: /new workspace/i });
		if (await newWsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newWsBtn.click();
			// Fill both name and slug. Slugs are globally unique, so use a
			// timestamp to avoid collisions across runs.
			const testSlug = `e2e-${Date.now()}`;
			await page.locator('input[name="workspace-name"]').fill("E2E Workspace");
			await page.locator('input[name="workspace-slug"]').fill(testSlug);
			await page.getByRole("button", { name: "Create" }).click();
			// Wait until we leave the /workspaces page (entered a workspace page)
			await page.waitForURL((u) => !u.pathname.startsWith("/workspaces"), {
				timeout: 10000,
			});
		}
	}

	await page.context().storageState({ path: AUTH_FILE });
});
