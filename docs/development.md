# Notara — Development

Back to the [README](../README.md).

## Development

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.1

```bash
git clone https://github.com/dnzzl/notara
cd notara
bun install
bun run setup   # patches a dependency, registers git hooks — see CONTRIBUTING.md

# Terminal 1 — backend
bun run dev:server
# Terminal 2 — frontend
bun run dev:app
```

Open `http://localhost:5173`. Create `.env` in the repo root with at least
`BETTER_AUTH_SECRET=any-random-string-for-dev`.

```bash
bun run build              # production build
bun test                   # unit tests
bunx playwright test       # E2E (requires built app)
# Visual baselines come from CI's container, never a dev machine: regenerate with
# docker run --rm -v "$PWD":/w -v /w/node_modules -w /w mcr.microsoft.com/playwright:v<@playwright/test version>-noble \
#   sh -c "npm i -g bun && bun install --frozen-lockfile --ignore-scripts && bun run apply-patches && bun run --filter @notara/shared build && bunx playwright test --update-snapshots"
```
