# ADR-011: Effect 4.0.0 LTS Everywhere, `packages/cli` Ported to `effect/cli`

**Status:** Accepted
**Date:** 2026-10-01
**Scope:** The Effect dependency across the monorepo. Supersedes ADR-010.

## Context

ADR-010 moved `shared`, `server` and `app` to `effect@4.0.0-rc.112` and froze
`packages/cli` on Effect 3, because no v4-compatible `@effect/cli` existed. Effect
4.0 shipped on 2026-09-30 with a long-term support policy — bug fixes until
September 2029 — so the RC pin lost its reason: the RC's interfaces were "presumed
final", 4.0.0's are contractually supported. The RC surface also still used the
`effect/unstable/*` import paths that 4.0.0 dropped without compatibility exports.

Meanwhile the workspace ran two Effect majors and an RC at once: one runtime and
type graph for `shared`/`server`/`app`, another for `packages/cli`, plus v3-only
packages (`@effect/cli`, `@effect/platform`, `@effect/printer`, `@effect/printer-ansi`)
that receive no v4 release.

## Decision

- `shared`, `server`, `app`: `effect@4.0.0`, exact, with `@effect/platform-node` and
  `@effect/sql-sqlite-bun` also at `4.0.0`. Exact pins carried over from ADR-010:
  the ecosystem releases in lockstep, so a `^` range on one package can drift from
  its siblings between installs.
- Import paths: `effect/unstable/*` → `effect/*` (40 source files, mechanical; the
  migration guide's rename maps cover everything else).
- `packages/cli`: ported to `effect/cli` — the CLI now ships inside the core
  package, which has zero runtime dependencies — plus `@effect/platform-node@4.0.0`.
  Dropped `@effect/cli`, `@effect/platform`, `@effect/printer`, `@effect/printer-ansi`.
  The port is the guide's rename map: `Options` → `Flag`, `Args` → `Argument`,
  `Command.run` → `Command.runWith`, `NodeContext.layer` → `NodeServices.layer`,
  `NodeHttpClient.layer` → `NodeHttpClient.layerNodeHttp`, `HttpClientRequest.del` →
  `.delete`.
- **Rejected:** keep the CLI frozen on Effect 3. That leaves a second Effect major
  in the workspace indefinitely, on packages that no longer ship v4 builds, to avoid
  a mechanical rename in a 1k-line file. Also rejected: rewriting the CLI without
  Effect — it works, and `effect/cli` is the same codebase as `@effect/cli`.

## Consequences

- One Effect version (4.0.0) across all four packages. `effect-tsgo`'s
  `duplicatePackage` and `outdatedApi` rules report nothing, and the probe that
  flags `Effect.catchAll`/`Effect.zipRight` as v3 APIs still fires — so a clean
  run means clean, not a silent linter.
- The wire format ADR-010 called out (flattened `Cause`, `Fail`-array envelope) is
  unchanged by leaving the RC: the app's decoder round-trips against a live server
  (`AuthError` encoded as `[{_tag:"Fail", error}]` over `POST /api`).
- `scripts/patch-msgpackr.sh`, `fix-msgpackr.sh` and
  `patches/@effect+platform+0.96.0.patch` patch `@effect/platform`, which is no
  longer a dependency of anything. On a fresh install they find nothing to patch.
  Left in place — retiring them with the `apply-patches` step and the CI/Docker
  lines that call it is a separate change.
- Verified: `bun run typecheck`, `typecheck:tests`, `test` (all four packages),
  `lint:effect`, `check-effect-errors.sh`, `check-bundle-size.sh`, `biome ci`.
  App bundle 2.416 MB raw / 604.9 kB gzip against a stored baseline of
  2.406 MB / 601.0 kB (+0.4% / +0.7%, well inside the 10% threshold). Browser-level
  verification ran through `agent-browser` (Chrome via CDP) against the built app
  served by the migrated server: signup, workspace creation, block typing with
  reload persistence, page rename, ⌘K search, presence stream — 186 responses all
  200, zero server errors, zero page errors. That run found two pre-existing search
  defects (SQLite/schema, not Effect) filed as NOT-142. The Playwright *suite* still
  runs in CI only: this machine's NixOS cannot execute Playwright's Chromium (the
  same `stub-ld` limitation that keeps `bunx biome` from running locally).
