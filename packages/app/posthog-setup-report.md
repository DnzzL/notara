# PostHog post-wizard report

The wizard has completed a PostHog analytics integration for Notara. PostHog was already partially set up (`posthog-js` installed, `analytics.ts` wrapper, GDPR consent gating, and `AnalyticsIdentity` for user identification). This run extended that foundation with: a reverse-proxy Vite config for `/ingest`, `capture_exceptions` and `defaults` options, a `captureException` export, and eight new `capture()` call-sites across five files covering the core product funnel.

| Event | Description | File |
|---|---|---|
| `sign_in_succeeded` | User successfully signed in via email or Google OAuth. Properties: `method` (email/google), `mode` (login/register). | `src/routes/login.tsx` |
| `workspace_joined` | User joined an existing workspace via an invite token. | `src/routes/workspaces.tsx` |
| `onboarding_tour_started` | Onboarding product tour started. Properties: `trigger` (auto/manual). | `src/components/OnboardingTour.tsx` |
| `onboarding_tour_completed` | User reached the final step of the onboarding tour. | `src/components/OnboardingTour.tsx` |
| `onboarding_tour_skipped` | User dismissed or skipped the tour before the final step. | `src/components/OnboardingTour.tsx` |
| `import_started` | User clicked Import with a Notion export ZIP selected. | `src/components/ImportModal.tsx` |
| `import_succeeded` | Notion import completed. Properties: `pages_imported`, `databases_imported`. | `src/components/ImportModal.tsx` |
| `page_shared` | User granted a workspace member individual access to a page. Properties: `relation` (viewer/editor/owner). | `src/components/SharePageModal.tsx` |

Pre-existing events retained: `checkout_clicked` (LandingPage.tsx) — already instrumented before this run.

Server-side events (tracked via `posthog-node` in `packages/server/src/observability.ts`) were left unchanged: `signup_completed`, `workspace_created`, `page_created`.

## Next steps

A dashboard and five insights have been created to monitor user behavior based on the instrumented events:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/194053/dashboard/755590)
- [Sign-ins over time](https://eu.posthog.com/project/194053/insights/4wqNjQV8) — Daily unique users signing in
- [Sign-in → Workspace joined → Checkout funnel](https://eu.posthog.com/project/194053/insights/40Q6Gy1V) — Core acquisition funnel
- [Onboarding tour funnel](https://eu.posthog.com/project/194053/insights/gB89DEoF) — Tour start → completion rate
- [Import success rate](https://eu.posthog.com/project/194053/insights/svJNw9ja) — Import started vs succeeded
- [Checkout intent](https://eu.posthog.com/project/194053/insights/8o2zWzIA) — checkout_clicked over time

## Verify before merging

- [ ] Run a full production build (`bun run build` in `packages/app`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to `.env.example` (and any bootstrap scripts) so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or Vite's upload step) into CI so production stack traces de-minify — this is a Vite-based SPA.
- [ ] Confirm the returning-visitor path also calls `identify` — `AnalyticsIdentity.tsx` handles this via session state, but verify that users who reload the app mid-session are re-identified before their first captured event.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-react-tanstack-router-code-based/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
