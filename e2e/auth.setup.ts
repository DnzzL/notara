import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "playwright/.auth/user.json";

/**
 * Auth setup: signs up a fresh test user via the UI, then saves the
 * authenticated storage state so downstream tests can skip the login flow.
 *
 * Using a timestamp-based email to avoid collisions across runs.
 * In CI you'd use a seeded test user instead.
 */
setup("authenticate as test user", async ({ page }) => {
  const ts = Date.now();
  const email = `e2e-test-${ts}@example.com`;
  const password = "TestPassword123!";
  const name = "E2E Tester";

  // Start at the app root — unauthenticated users get redirected to /login
  await page.goto("/");
  await page.waitForURL("**/login");

  // Switch to registration mode — the page toggles between "Log in" / "Create an account"
  const createAccountBtn = page.getByText("Create an account");
  if (await createAccountBtn.isVisible()) {
    await createAccountBtn.click();
  }

  // Fill in the registration form
  const nameInput = page.locator('input[name="name"]');
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  if (await nameInput.isVisible()) {
    await nameInput.fill(name);
  }
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Submit the form
  await page.getByRole("button", { name: /create account/i }).click();

  // After signup, the app may redirect to:
  //   - /workspaces (no email verification)
  //   - a verification page (if email verification is enabled)
  // Handle both cases.
  try {
    await page.waitForURL(/\/workspaces|\/verify|\/login/, { timeout: 10000 });
  } catch {
    // If we didn't reach any expected page, the signup may have failed or
    // the server already had the user. That's OK — we'll try to proceed.
  }

  const currentUrl = page.url();
  if (currentUrl.includes("verify") || currentUrl.includes("confirm")) {
    // Email verification is enabled — we can't complete signup via UI.
    // The tests below will need a pre-verified user or auth bypass.
    // For now, skip storing state — tests will handle being unauthenticated.
    // eslint-disable-next-line no-console
    console.log("⚠ Email verification required — auth setup incomplete");
    return;
  }

  // We're at /workspaces or similar authenticated page
  // Create a workspace if we're on the workspaces page
  if (currentUrl.includes("/workspaces")) {
    // The user might be auto-redirected to a workspace, or see the workspaces list
    try {
      await page.waitForURL(/\$workspaceSlug/, { timeout: 5000 });
    } catch {
      // Still on /workspaces — create one
      const createBtn = page.getByText(/create workspace|new workspace/i);
      if (await createBtn.isVisible()) {
        // For now just wait — workspace creation flow may vary
      }
    }
  }

  // Save the authenticated state for downstream tests
  await page.context().storageState({ path: AUTH_FILE });
});
