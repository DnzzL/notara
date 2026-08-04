import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Every spec shares one auth session and one workspace, and the app pushes
  // live-collab updates between sessions — so concurrent workers mutate each
  // other's view (pages created by one worker re-render another's sidebar and
  // can navigate it away mid-test). Serial until each worker gets its own
  // workspace.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: "auth.setup.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Load authenticated state from auth setup
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      // The multiuser specs build one context per user and must not inherit the
      // single-user storageState above.
      testIgnore: /multiuser-.*\.spec\.ts/,
    },
    {
      // Multiuser specs sign up their own users and get a fresh workspace per
      // test, so they need neither the shared auth session nor the serial
      // execution the comment above describes.
      name: "multiuser",
      testMatch: /multiuser-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      fullyParallel: true,
    },
  ],
  webServer: {
    command: "set -a && . ./.env && set +a && cd packages/server && bun src/index.ts & cd packages/app && bunx vite",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
