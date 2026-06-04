# Notara

A self-hostable, source-available Notion alternative. Block editor, inline databases, team workspaces — all stored in a single SQLite file on your own server. Yours to own, no subscription.

**[Live demo](#) · [API docs](/api/docs) · [Commercial license](./LICENSE)**

---

## Features

- **Block editor** — paragraphs, headings, todos, code, toggles, callouts, images, PDFs and more
- **Inline databases** — table and board views with fields, relations and custom views
- **Team workspaces** — invite members by email or link, owner/member roles
- **Full-text search** — across page titles and block content
- **Trash & restore** — soft-delete pages, databases and records; restore anytime, with an automatic purge after a configurable retention window
- **Import / Export** — Notion Markdown and CSV imports; export back out anytime
- **S3 backups** — optional scheduled backups to any S3-compatible bucket
- **REST API** — full HTTP API with API key auth and [Swagger docs](/api/docs)
- **CLI** — scriptable `notara` command-line client over the REST API ([packages/cli](./packages/cli))
- **Self-hostable** — one Docker command, no external dependencies

---

## Quick start (Docker Compose)

```bash
curl -O https://raw.githubusercontent.com/notara/notara/main/docker-compose.yml
# Edit the environment section (see below)
docker compose up -d
```

Open `http://localhost:3000` and create your account.

---

## Environment variables

Copy the block below into your `docker-compose.yml` → `environment:` section or a `.env` file.

### Required

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | **Secret key** used to sign session tokens. Generate with `openssl rand -base64 32`. Rotate this and all sessions are invalidated. |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port the server listens on. |
| `DATA_DIR` | `./.data` | Directory where SQLite databases and file attachments are stored. Mount a persistent volume here. |
| `BASE_URL` | `http://localhost:3000` | Public URL of the instance. Used in email invite links and password reset emails. Must match what users type in their browser. |
| `TRUSTED_ORIGINS` | `http://localhost:5173` | Comma-separated list of origins allowed for CORS and session cookies. Set to your public URL in production, e.g. `https://notes.example.com`. |

### Email / SMTP

All `SMTP_*` variables are optional. Without them the app runs fine but password reset and email invitations are disabled.

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | Mail server hostname, e.g. `smtp.resend.com`, `smtp.sendgrid.net`, `mail.example.com`. |
| `SMTP_PORT` | `587` | `587` for STARTTLS (recommended), `465` for implicit SSL, `25` for plain (not recommended). |
| `SMTP_SECURE` | `false` | Set to `true` only when using port `465` (implicit SSL). Leave unset or `false` for port `587`. |
| `SMTP_USER` | — | SMTP username — usually your email address or an API key username. |
| `SMTP_PASS` | — | **Secret.** SMTP password or API key. See provider examples below. |
| `SMTP_FROM` | `Notara <no-reply@notara.app>` | The "From" address on outgoing emails. Use a domain you control to avoid spam filters, e.g. `Notara <no-reply@example.com>`. |

#### SMTP provider examples

<details>
<summary><strong>Resend</strong> (recommended for new installs)</summary>

Create a free account at [resend.com](https://resend.com), verify a domain, and generate an API key.

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxx   # your Resend API key
SMTP_FROM=Notara <no-reply@yourdomain.com>
```
</details>

<details>
<summary><strong>Postmark</strong></summary>

```env
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<your-server-api-token>
SMTP_PASS=<your-server-api-token>   # same token for user and pass
SMTP_FROM=Notara <no-reply@yourdomain.com>
```
</details>

<details>
<summary><strong>Mailgun</strong></summary>

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@mg.yourdomain.com
SMTP_PASS=<your-mailgun-smtp-password>
SMTP_FROM=Notara <no-reply@yourdomain.com>
```
</details>

<details>
<summary><strong>Gmail</strong> (personal / low-volume)</summary>

Enable 2FA on your Google account and generate an [App Password](https://myaccount.google.com/apppasswords).

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # 16-char App Password (spaces are fine)
SMTP_FROM=you@gmail.com
```
</details>

<details>
<summary><strong>Self-hosted (Postfix / Exim / Maddy)</strong></summary>

```env
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_USER=notara@example.com
SMTP_PASS=<your-smtp-password>
SMTP_FROM=Notara <notara@example.com>
```
</details>

### Google OAuth (optional)

Adds a "Continue with Google" button on the login page. Without these the app uses email/password only.

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from [Google Cloud Console](https://console.cloud.google.com). |
| `GOOGLE_CLIENT_SECRET` | **Secret.** OAuth client secret. Add `<BASE_URL>/api/auth/callback/google` as an authorised redirect URI. |

### S3 backups (optional)

Configure in the Settings panel at runtime, or pre-seed via environment variables. Works with AWS S3, Backblaze B2, Cloudflare R2, MinIO, and any other S3-compatible service.

The settings UI (⚙ Settings → S3 backup) saves these to `.data/settings.json`. Environment variables are not read at runtime for S3 — use the settings UI after first login.

### PostHog (optional)

Tracks usage analytics and error reports. Both server and client need their own PostHog project source. Without these, no data is sent anywhere.

#### Server-side (error reporting + product events)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTHOG_KEY` | — | PostHog project API key. When set, enables server-side error reporting and product analytics (signups, workspace creation, page creation). |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` | PostHog instance host. Change to `https://us.i.posthog.com` for US-region projects, or a self-hosted PostHog URL. |

#### Client-side (frontend analytics)

These are Vite environment variables — prefix them with `VITE_` and make them available to the frontend build (via `.env` or `docker compose` environment).

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_POSTHOG_KEY` | — | PostHog project API key for the frontend. Enables pageviews, autocapture, and frontend events. |
| `VITE_POSTHOG_HOST` | `https://eu.i.posthog.com` | PostHog instance host for the frontend. |

> **Privacy:** PostHog is only loaded after the user accepts the consent banner (GDPR opt-in). The `distinctId` passed to PostHog is the user's internal ID — never an email or other PII.

### Admin panel (optional)

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAILS` | Comma-separated list of email addresses that can access `/admin`. E.g. `alice@example.com,bob@example.com`. Without this the admin panel is disabled. |

---

## Full docker-compose.yml example

```yaml
services:
  notara:
    image: ghcr.io/notara/notara:latest
    ports:
      - "3000:3000"
    volumes:
      - notara-data:/data
    restart: unless-stopped
    environment:
      # ── Required ───────────────────────────────────────────────────
      BETTER_AUTH_SECRET: "replace-with-openssl-rand-base64-32-output"

      # ── Server ─────────────────────────────────────────────────────
      DATA_DIR: /data
      BASE_URL: "https://notes.example.com"
      TRUSTED_ORIGINS: "https://notes.example.com"

      # ── Email / SMTP (optional) ────────────────────────────────────
      SMTP_HOST: "smtp.resend.com"
      SMTP_PORT: "587"
      SMTP_USER: "resend"
      SMTP_PASS: "re_xxxxxxxxxxxxxxxxxxxx"
      SMTP_FROM: "Notara <no-reply@example.com>"

      # ── Google OAuth (optional) ────────────────────────────────────
      # GOOGLE_CLIENT_ID: ""
      # GOOGLE_CLIENT_SECRET: ""

      # ── PostHog analytics (optional) ───────────────────────────────
      # POSTHOG_KEY: "phx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      # POSTHOG_HOST: "https://eu.i.posthog.com"

      # ── Admin (optional) ───────────────────────────────────────────
      # ADMIN_EMAILS: "you@example.com"

volumes:
  notara-data:
```

---

## Running behind a reverse proxy

Set `BASE_URL` and `TRUSTED_ORIGINS` to your public domain. Example Caddy config:

```
notes.example.com {
    reverse_proxy localhost:3000
}
```

Nginx:

```nginx
server {
    listen 443 ssl;
    server_name notes.example.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## REST API

Notara exposes a fully documented REST API at `/api/v1`. Useful for automation, scripting, and integrations.

- **Interactive docs** — `GET /api/docs` (Swagger UI)
- **OpenAPI spec** — `GET /api/v1/openapi.json`

**Authentication**: generate an API key in the sidebar → "API keys". Then pass it as:

```http
Authorization: Bearer ntr_your_key_here
```

**Example** — list pages in a workspace:

```bash
curl https://notes.example.com/api/v1/workspaces/<workspaceId>/pages \
  -H "Authorization: Bearer ntr_your_key_here"
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1

### Setup

```bash
git clone https://github.com/notara/notara
cd notara
bun install
```

### Run locally

```bash
# Terminal 1 — backend
bun run dev:server

# Terminal 2 — frontend
bun run dev:app
```

Open `http://localhost:5173`.

### Environment for local dev

Create `.env` in the repo root (or `packages/server/.env`):

```env
BETTER_AUTH_SECRET=any-random-string-for-dev
# SMTP_HOST=...   # optional — email features disabled without it
```

### Build

```bash
bun run build
```

### Tests

```bash
bun test                  # unit tests
bunx playwright test      # E2E tests (requires built app)
```

---

## Data directory layout

```
.data/
├── platform.db          # auth, users, workspaces
├── workspaces/
│   └── <workspace-id>.db  # pages, blocks, databases (one file per workspace)
├── attachments/         # uploaded images and PDFs
└── settings.json        # S3 backup config
```

Back up the entire `.data/` directory to keep everything. The S3 backup feature zips and uploads it automatically.

---

## Deployment

Notara is shipped as a **single-instance** application. The built-in rate limiter and presence state are in-process and not shared across instances. Run it as a single container behind your reverse proxy of choice (the bundled `nginx.conf` is a fine starting point); scale up by giving it a bigger VM rather than horizontal pods.

---

## Reporting bugs

Open an issue using the **Bug report** template — it asks the questions that turn a vague complaint into a fixable problem:

1. **Version / commit** — `git rev-parse --short HEAD` of your install, or the version in the app footer.
2. **Deployment** — Docker Compose, bare metal, local dev, or hosted.
3. **Browser + OS** — vendor and version (e.g. *Chrome 132 on macOS 14.5*).
4. **Expected vs actual** — one sentence each.
5. **Steps to reproduce** — numbered list, shortest path that triggers it.
6. **Logs** — browser console and `docker logs notara-server`, secrets redacted.

Open the template directly: <https://github.com/dnzzl/notara/issues/new?template=bug_report.yml>

> Security vulnerabilities: please email **legrand.thomas5@hotmail.fr** instead of opening a public issue.

Feature requests use the **Feature request** template. The two questions that decide whether a request lands are *what problem does it solve* and *who has that problem* — please answer those before suggesting an implementation.

---

## License

Notara is **source-available, commercial software**. By purchasing a license you receive the source code, the right to deploy on your own instances (no seat limit), and lifetime updates. You may modify the code for internal use. Redistribution and operation as a hosted service for third parties are not permitted. See [LICENSE](./LICENSE) for the full terms.
