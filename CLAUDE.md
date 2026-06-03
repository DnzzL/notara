# CLAUDE.md

Behavioral guidelines for working on Notara. Read once per session; apply throughout.

**Tradeoff:** these rules bias toward restraint over speed. For trivial edits, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

This codebase has a written constraint from its author: *"sans empiler des features à la pelle, sans complexifier le code avec des checks dans tous les sens."* Take it literally.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans, remove imports/variables/functions that **your** changes made unused. Don't remove pre-existing dead code unless asked.

Pre-existing TS errors in `packages/app` (`PageReferenceMenu` extensions, `import.meta.env` in `__root.tsx`, etc.) are **not yours** — don't fix them unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform vague tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."

Standard verification on this repo:
```
bun --bun tsc --noEmit -p packages/server   # server type-check
bun --bun tsc --noEmit -p packages/app      # app type-check (ignore pre-existing errors)
bun test packages/server/test               # 91 tests, ~1.3s
```

If you can't run these, say so explicitly rather than claiming success.

## 5. Notara-Specific Rules

**Decisions that already cost discussion. Don't re-debate without explicit ask.**

- **Commercial posture is settled.** Source-available, EULA, **single tier**, €29 one-time, first 500 buyers, distribution via Polar GitHub Repository Benefit. No subscription, no cloud, no entitlements service. See `docs/adr/002-commercialization-source-available.md` and `docs/adr/003-single-tier-launch.md`.

- **No scattered tier/plan checks. Ever.** If a future Team tier lands, gating goes in `withAuthedWorkspace` (`packages/server/src/workspace-context.ts`) — and *only* there, at seat-add. Not in `createPage`, `createBlock`, `createDatabase`, or any other handler. If you find yourself reaching for an `entitlements` framework for 2 tiers, stop.

- **Mono-instance is intentional.** The rate limiter and presence state are in-process. Don't propose Redis-backed swaps; scale up the VM. Documented in `packages/server/src/middleware.ts`.

- **No new third-party SDK without updating `/privacy` in the same commit.** Privacy policy must reflect what the code actually does. Same rule for cookie banner: any new non-essential storage flows through `consent.ts`.

- **No `if (plan === ...)` in handlers. No PII in PostHog properties.** Use `userId` as `distinctId`, never log emails.

## 6. Architectural Map (just enough)

```
packages/server/src/
  index.ts                  RPC + REST + auth wiring; layer composition
  auth.ts                   Better Auth: email/Google, verification, welcome email
  observability.ts          PostHog errors + 4 funnel events + JSON logger
  workspace-context.ts      THE chokepoint (withAuthedWorkspace)
  middleware.ts             in-process rate limiter (mono-instance)
  handlers/
    onboarding.ts           "Getting Started" seed on workspace create
    permissions.ts          Zanzibar ACL checks
    workspaces.ts           seats live here; future tier gate would too

packages/app/src/
  analytics.ts              posthog-js wrapper
  consent.ts                GDPR opt-in state (localStorage)
  components/
    ConsentBanner.tsx       bottom banner, Reject == Accept
    AnalyticsIdentity.tsx   binds session → identify()
    LandingPage.tsx         single tier, €29, hard cap 500
  routes/{privacy,terms}.tsx  GDPR + ToS

packages/shared/src/api.ts  RPC schema + bounded string types
docs/adr/                   Decision log — append, don't rewrite
```

## 7. Known Debt (don't surprise me)

- **SQLite FK pragma is OFF** — `ON DELETE CASCADE` never fires. Hard-deletes must remove children explicitly. Memory: `sqlite-fk-off`.
- **Notara import is not idempotent** — re-running clones every database. Memory: `notara_import_duplicates`. Needs source→target ID map before next launch.
- **Backup restore** triggers process exit + container restart; relies on the orchestrator. By design.

Flag these if they become relevant to the task — but don't "fix" them without being asked.

## 8. Bug Reporting Workflow

If you discover a bug while working: either fix it inline (if scoped to the current task) or open an issue:

```bash
gh issue create --template bug_report.yml \
  --title "[bug] <summary>" \
  --body-file <(cat <<EOF
... fields per template ...
EOF
)
```

Template fields in `.github/ISSUE_TEMPLATE/bug_report.yml`. Security issues go to email, never public.

---

**These guidelines are working if:** diffs contain only requested changes, third-party additions update privacy in the same commit, no `plan` checks appear outside `withAuthedWorkspace`, and clarifying questions come *before* implementation rather than after mistakes.
