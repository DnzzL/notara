# Notara — Project Memory for Claude

Use this file as the load-bearing context for any future session on this
codebase. Memories under `~/.claude/projects/.../memory/` carry deeper
specifics; this file captures **what is decided, what is shipped, and
where to look** so that you don't need to rediscover them every turn.

---

## 1. What Notara is

A self-hostable, source-available Notion alternative.
- Block editor (TipTap), inline databases, full-text search, ACL Zanzibar, REST + RPC.
- Server: Bun + Effect-TS + SQLite (one DB per workspace) + Better Auth.
- Frontend: React 19 + TanStack Router + Zustand.
- Desktop: Electron wrapper exists in `packages/electron`.

Mono-instance by design — the rate limiter and presence state are in-process. Scale up, not out.

## 2. Commercial posture (DECIDED — do not re-debate without explicit ask)

- **License**: commercial source-available EULA at `/LICENSE` (not MIT).
- **Distribution**: private GitHub repo, access granted by Polar's GitHub Repository Benefit on purchase.
- **Pricing**: one product, one tier — *Notara Self-Host*. Early-bird **€29 one-time, lifetime updates, capped at first 500 buyers**. Standard price after cap: €49–59.
- **No subscription. No cloud managed offering. No multi-tier features. No entitlements service.**
- See `docs/adr/002-commercialization-source-available.md` and `docs/adr/003-single-tier-launch.md` for rationale. If you find yourself adding a `plan` column or a per-feature gate, **stop and re-read those ADRs.**

## 3. Repository layout (the parts that matter)

```
packages/
  server/          Effect-TS server, handlers/, migrations/, RPC + REST
    src/index.ts                 main entry, RPC handler wiring, layers
    src/auth.ts                  Better Auth config (email + Google OAuth,
                                 verification, welcome email, signup track)
    src/observability.ts         PostHog (errors + product analytics) + JSON Logger
    src/middleware.ts            in-process rate limiter (mono-instance only)
    src/workspace-context.ts     withAuthedWorkspace (the chokepoint — if a
                                 future Team tier ever lands, gating goes HERE
                                 and ONLY here)
    src/handlers/onboarding.ts   "Getting Started" seed on workspace create
    src/handlers/permissions.ts  Zanzibar ACL check helpers
  app/             React frontend
    src/analytics.ts             PostHog client helpers (init/capture/identify)
    src/consent.ts               GDPR consent state (localStorage key
                                 `notara_consent`)
    src/components/ConsentBanner.tsx   bottom-anchored opt-in banner
    src/components/AnalyticsIdentity.tsx   binds session → PostHog identify
    src/components/LandingPage.tsx
    src/routes/{privacy,terms}.tsx     public legal pages
  shared/          Effect Schema + RPC group + shared types
    src/api.ts                   RPC schema with validation primitives
                                 (TitleString, ShortName, Slug, Email, ...)
  electron/        Desktop wrapper
docs/
  adr/             Architecture Decision Records — append, don't rewrite
  pitch.md         Product vision (older; cross-check before quoting)
```

## 4. Observability (PostHog, opt-in only)

- Errors: `reportError()` in `observability.ts` → PostHog `captureException`.
- Funnel events (currently tracked):
  - `signup_completed`  — server, in `auth.ts` user-create hook.
  - `workspace_created` — server, in `index.ts` RPC handler.
  - `page_created`      — server, in `index.ts` RPC handler.
  - `checkout_clicked`  — frontend, in `LandingPage.tsx`.
- Autocapture (pageviews + clicks) is **enabled only after consent**.
- EU host by default (`https://eu.i.posthog.com`).
- Env: `POSTHOG_KEY` (server), `VITE_POSTHOG_KEY` (frontend), optional `POSTHOG_HOST` / `VITE_POSTHOG_HOST`.

Do **not** add more events without a clear "decision this answers" — the funnel is intentionally small.

## 5. Privacy & GDPR (compliance posture)

- Privacy Policy at `/privacy`, Terms at `/terms`. Both link from the landing footer.
- Cookie consent banner gates **all non-essential** storage.
- Opt-in only. Reject is one click and equal in visual weight to Accept.
- Consent withdrawal: clear `notara_consent` in localStorage (also documented in /privacy).
- Controller / contact: Thomas Legrand · thomas.legrand@freelancerepublik.com.
- 30-day SLA for data subject requests (Art. 15–21 GDPR).

Before adding any third-party SDK or tracker, check it against the privacy policy. If it isn't listed, either don't add it, or update the policy in the same commit.

## 6. Environment variables

### Server (required)
- `BETTER_AUTH_SECRET` — 32-hex-char session secret.

### Server (optional but recommended for prod)
- `BASE_URL` — public URL for email links (default `http://localhost:3000`).
- `TRUSTED_ORIGINS` — comma-separated CORS allow-list.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` — without these, welcome / verification / invite emails are no-ops and email verification at signup is disabled.
- `POSTHOG_KEY` / `POSTHOG_HOST` — observability + analytics.
- `SENTRY_DSN` — *not used* anymore; ignore.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for Google OAuth sign-in.
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT` — scheduled S3 backups.
- `ADMIN_EMAILS` — comma-separated, grants access to `/api/admin/*`.
- `TRASH_RETENTION_DAYS` — default 30.
- `DATA_DIR` — where SQLite + attachments live (default `.data/`).
- `PORT` — default 3000.
- `LOG_LEVEL` — `Debug`/`Info`/`Warning`/`Error` (default `Info` in prod).
- `NODE_ENV` — `production` enables JSON logger.

### Frontend (Vite, build-time)
- `VITE_POLAR_CHECKOUT_URL` — Polar product checkout URL embedded into the landing CTAs.
- `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` — frontend analytics.

## 7. Filing bugs

Bug reports go through `.github/ISSUE_TEMPLATE/bug_report.yml`. The template enforces:
- Notara version / commit
- Deployment (Docker Compose / bare metal / local / cloud)
- Browser + OS
- Expected vs actual
- Reproduction steps (numbered)
- Logs (browser + server, redacted)
- Confirmation of no duplicates and no secrets

For security issues, contact link in `.github/ISSUE_TEMPLATE/config.yml` routes to email. **Do not open public security issues.**

If you (Claude) discover a bug while working, either fix it inline or open an issue via `gh issue create --template bug_report.yml --title "[bug] …" --body-file …` — the template fields map to YAML keys.

## 8. Decisions still pending (not blockers, but flagged)

- **SQLite FK pragma is OFF**: `ON DELETE CASCADE` never fires at runtime. Hard-deletes must remove children explicitly. See memory `sqlite-fk-off`.
- **Notara import is not idempotent**: re-running imports clones every database. See memory `notara_import_duplicates`. To fix: maintain a source→target ID map in the import handler.
- **Backup restore path** triggers a process exit + container restart; relies on the orchestrator restarting us. Documented in `handlers/restore.ts`.

These are technical debt, not launch blockers, but they will bite a user eventually.

## 9. House style for changes

- Edit existing files in preference to creating new ones.
- No `if (plan === 'pro')` checks scattered across handlers. **Ever.** Tier gating goes in `withAuthedWorkspace` or nowhere.
- No new third-party trackers / analytics SDKs without updating `/privacy` in the same commit.
- Tests: `bun test packages/server/test` from repo root.
- Typecheck: `bun --bun tsc --noEmit -p packages/server` (and `-p packages/app`).
- Pre-existing TS errors in `packages/app` (`PageReferenceMenu`, `__root.tsx env`) are not yours — don't try to fix them unless asked.

---

Last refresh: 2026-06-02. If you touch any of decisions #2, #4, #5, update this file in the same PR.
