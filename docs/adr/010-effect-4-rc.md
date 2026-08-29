# ADR-010: Migrate to Effect 4 RC, Freeze `packages/cli` on Effect 3

**Status:** Accepted
**Date:** 2026-08-29
**Scope:** The Effect dependency across the monorepo. Records why one package didn't move.

## Context

`shared`, `server`, and `app` ran `effect@3.21.2` alongside a fan of separately
versioned `@effect/*` packages (`platform`, `rpc`, `sql`, ...) that had drifted out of
lockstep — `@effect/rpc@0.65.2` demanded `@effect/platform ^0.88`, the root
`resolutions` pinned `0.96.0`, and `@effect/rpc-http` dragged in a second, older
`@effect/rpc@0.44.31` nobody imported. Effect 4 collapses this: one version for the
whole ecosystem, and `@effect/platform`, `@effect/rpc`, `@effect/sql` fold into
`effect` itself under `effect/unstable/*`.

`packages/cli` depends on `@effect/cli` and `@effect/printer`, neither of which ships
an RC tag. Migrating it would mean hand-rolling `Options`/`Args`/`Command` against
v4's `effect/unstable/cli` (`Flag`, `Argument`, ...) for no payoff, since the CLI is a
thin HTTP client with its own error type and no `@notara/shared` dependency — nothing
forces it onto the same Effect version as the rest of the workspace.

## Decision

- `shared`, `server`, `app`: pinned to `effect@4.0.0-rc.112`, exact (not `^`), since
  the RC's interfaces are "presumed final" but not guaranteed stable between RC
  builds. `@effect/platform`, `@effect/rpc`, `@effect/sql` removed as direct
  dependencies — their functionality now comes from `effect/unstable/http`,
  `effect/unstable/rpc`, `effect/unstable/sql`. `@effect/platform-node` and
  `@effect/sql-sqlite-bun` remain separate packages, also pinned to `4.0.0-rc.112`.
- `packages/cli`: pinned to `effect@3.21.2` and the last-compatible `@effect/{cli,
  platform,platform-node,printer,printer-ansi}` versions, exact. Verified before
  freezing that it imports nothing from `@notara/shared`, so it never shares a type
  graph with the v4 packages — bun's workspace resolver nests its own `effect@3`
  under `packages/cli/node_modules` rather than hoisting the v4 one.
- Removed the root `resolutions["@effect/platform"]` entry — it existed to force
  the v3 packages into lockstep and would otherwise pin a package that no longer
  exists on the v4 side of the tree.
- Dropped `@effect/rpc-http` from `server` and `app`: zero imports, dead weight
  pulling in the mismatched transitive `@effect/rpc@0.44.31`.

## Consequences

- **Wire format changed.** v4 flattens `Cause` from a `Fail | Die | Interrupt |
  Sequential | Parallel` tree to `{ reasons: Array<Fail | Die | Interrupt> }`. The
  RPC error envelope (`ApiCause` in `packages/shared/src/errors.ts`) encodes a
  `Cause`, so the JSON shape on the wire changed with it. A client built against the
  old shape decodes an unrecognized cause as `None` and shows "Unknown server
  error" instead of the typed failure — a real UX regression, not a compile error,
  so it won't show up in `tsc` or the test suite.

  This matters because the app is a PWA with a service worker
  (`packages/app/src/lib/sw-update.ts`) that can serve a cached v3 client against a
  freshly deployed v4 server. **Mitigation:** the SW update path already takes new
  versions immediately (`packages/app/src/lib/sw-update.ts`, `bd9c609`-era fix) —
  confirm this ships in the same release as this migration, or the stale-client
  window is exactly the failure mode described above.
- `bun run typecheck`, `bun run typecheck:tests`, `bun test` (all four packages),
  `bun run lint:effect`, and `scripts/check-bundle-size.sh` all pass. Bundle-size
  baseline (`.github/bundle-sizes.json`) was reset: the app bundle shrank
  (~2.50MB → ~2.41MB raw, ~628KB → ~601KB gzip) with the v4 runtime rewrite.
- `packages/server/src/index.ts` keeps one narrow `as unknown as Effect<void,
  unknown, never>` cast at the `NodeRuntime.runMain` call site, unchanged from
  before this migration. It papers over a pre-existing `Effect<A, unknown, any>`
  annotation on `requireAdmin`'s parameter (unrelated to Effect 4) — not
  reintroduced to hide anything this migration broke; removing it during the
  migration is exactly how the real v4 errors (Cause, Schema, Stream, Logger) got
  found in the first place.
- Future v4 RC bumps: re-verify `packages/server/src/db.ts`'s `Config.ConfigError`
  usage and the `Stream.callback` rewrite in `sse-channel.ts` first — both are
  "unstable" surfaces per Effect's own module layout and are the most likely to
  shift before 4.0.0 stable.
