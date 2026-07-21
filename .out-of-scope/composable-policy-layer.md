# Composable Policy Layer Over Permission Checks

Add a Barake-style composable policy system (`Policy = Effect<void, Forbidden, R>` with `all`/`any`/`withPolicy` combinators) over the Zanzibar permission checks.

## Why this is out of scope

The current permission architecture in `packages/server/src/handlers/permissions.ts` is already the right level of simplicity for this codebase. Adding a policy layer would be an unnecessary indirection:

- **Permission checks are already centralized.** `checkPagePermission`, `checkBlockPermission`, `checkDatabasePermission`, etc. all live in one module. The `checkVia()` factory generates resource-specific checks from page-ID resolvers — the minimal seam a policy layer would provide already exists.

- **No composition need.** No handler in `rpc-handlers.ts` uses `OR`/`AND` logic between multiple permission checks. Every call site is a single `yield* Permissions.checkXxx(...)` line. A `withPolicy` combinator would have nothing to compose.

- **The attachment site is already clean.** Each handler has exactly one `yield*` permission check. Replacing `Permissions.checkPagePermission(...)` with `Policies.withPolicy(Policies.canEditPage(...))` would be a lateral move, not a simplification. This would violate CLAUDE.md rule 2: *"sans complexifier le code avec des checks dans tous les sens."*

- **The `.pipe(Effect.orDie)` repetition is unrelated.** Those ~50 calls are SQL query error handling (`sql.unsafe(...).pipe(Effect.orDie)`), not permission checks. A policy layer wouldn't affect them.

- **CLAUDE.md rule 5** (no scattered tier/plan checks) is already respected — zero tier/plan checks exist. No policy layer is needed to enforce it.

The current design balances clarity and conciseness well. The permission checks are visible, traceable, and uniform. Adding a policy abstraction would add a vocabulary concept (`Policy`, `withPolicy`, `all`, `any`) and an indirection seam where a direct function call currently suffices.

## Prior requests

- NOT-46 — Spike: evaluate a composable policy layer over the Zanzibar checks
