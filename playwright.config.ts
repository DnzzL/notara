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
    // Animations are the difference between a locator that resolves and one
    // Playwright will actually click: it waits for two stable frames, and a
    // card that pops in on every mount never gives it two. The app already
    // honours this for its landing-page reveals.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "setup",
      testMatch: "auth.setup.ts",
      // Same browser and viewport as the project that depends on it. Without
      // this the setup ran at Playwright's bare defaults while every spec it
      // feeds ran as Desktop Chrome.
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Load authenticated state from auth setup
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      // Specs that build their own contexts must not inherit the single-user
      // storageState above.
      testIgnore: /(multiuser|rest)-.*\.spec\.ts/,
    },
    {
      // Specs that sign up their own users and get a fresh workspace per test,
      // so they need neither the shared auth session nor the serial execution
      // the comment above describes. The name is historical: the distinguishing
      // property is bringing your own session, not having several of them.
      name: "multiuser",
      testMatch: /(multiuser|rest)-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      fullyParallel: true,
    },
  ],
  webServer: {
    // .env is a developer convenience and does not exist in CI, where the job
    // supplies the environment directly — so sourcing it must not be able to
    // stop the server from starting.
    command:
      "set -a && [ -f .env ] && . ./.env; set +a; cd packages/server && bun src/index.ts & cd packages/app && bunx vite",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
