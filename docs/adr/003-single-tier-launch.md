# ADR-003: Single-Tier Launch — Deferring Multi-Tier & Entitlements Service

**Status:** Accepted
**Date:** 2026-06-02
**Scope:** Number of commercial tiers at launch, and the deliberate non-decision to build a feature-gating mechanism.

## Context

ADR-002 establishes Notara as a source-available product sold via Polar. The natural follow-up question is: do we ship **Solo** and **Team** tiers (with different prices and seat limits) at launch, or just one tier?

Three structures were considered:

1. **Single tier** — one product, one EULA, no segmentation.
2. **Solo + Team with EULA-only enforcement** — two products, two licenses, same binary, honor system (Tailwind UI model).
3. **Solo + Team with a runtime license-key check** — same as #2 plus a signed key validating `max_seats` at the invite endpoint (~30–50 lines of code in one place).

## Decision

**Single tier at launch.** One product on Polar (`Notara Self-Host`), one EULA, no seat limit, commercial use permitted. No code change related to tiers or entitlements.

## Why

The single-tier approach is the only one fully consistent with the project's overall constraint *"sans empiler des features à la pelle, sans complexifier le code avec des checks dans tous les sens"*:

- **Zero new code for billing.** Possession of the repo is the entitlement. There is no `workspaces.plan` column, no `entitlements` service, no per-feature gate. `withAuthedWorkspace` in `packages/server/src/workspace-context.ts` remains untouched.
- **No signal to differentiate on.** With zero users today, we cannot calibrate a credible Solo-vs-Team boundary (seat threshold, feature split). Inventing one without data is guesswork.
- **Reversibility is free.** When the first buyer asks "and for my team?", we add a second Polar product, write a second EULA paragraph, and — *only if needed* — add a runtime license-key check at the seat-add endpoint. None of this is foreclosed by today's single-tier decision.

The two rejected options each introduce friction without proportional return at this stage:

- **Solo + Team / EULA-only** doubles the commercial surface (two pages, two messages, two pricing points to justify) without any user data to support the split.
- **Solo + Team / license-key** adds runtime complexity (key generation, signature validation, seat counting, error UX) for a market we have not yet validated.

## Architecture Implication: The Single Future Gating Seam

When (and only when) a multi-tier model becomes necessary, the entire gating logic will live at a single point in the codebase: the seat-add operations.

- `Workspaces.inviteMemberByEmail` (`packages/server/src/handlers/workspaces.ts`)
- `Workspaces.joinWorkspaceByToken` (`packages/server/src/handlers/workspaces.ts`)

These are the only endpoints that grow the `workspace_members` table. A future `License.assertCanAddSeat(workspaceId)` Effect would be called at the top of each — and that is the full extent of gating code, ever, for this product.

We commit explicitly to:

- **Never** scattering plan checks across page/block/database/record handlers.
- **Never** introducing a generic feature-flag-by-plan framework.
- Keeping any future tier difference purely about **seats and usage rights**, not feature lock-out, unless a single, well-scoped Pro feature (e.g., SSO) justifies it later.

## Consequences

**Positive**
- The initial launch has zero billing-related code in the runtime path.
- Engineering effort goes entirely into the things that drive conversion (onboarding, hardening) rather than monetization plumbing.
- The architecture remains "open" for tiers without committing to them prematurely.

**Negative**
- No upsell path at launch. A buyer who wants to pay more cannot.
- Larger teams using a single license without seat caps may extract more value than smaller buyers — accepted, since the alternative (capping seats) requires building the gating mechanism we are deferring.

## Related

- ADR-002 — Commercialization model overview.
- Memory: [[project-open-saas-gaps]] — prior OSS-flavored features that remain useful (admin panel, API keys, etc.) but are not gated by tier.
