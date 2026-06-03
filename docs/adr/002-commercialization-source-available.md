# ADR-002: Commercialization Model — Source-Available + Polar

**Status:** Accepted
**Date:** 2026-06-02
**Scope:** Licensing, distribution, and pricing model for the public launch.

## Context

Notara is technically solid (Effect-TS server, per-workspace SQLite, ACL Zanzibar, REST+RPC, backups S3) but has no users and no public repo. We need to commercialize it without contradicting the product's core pitch — "you own your data, no lock-in, self-hostable, no subscription."

Three competing models were evaluated:

1. **Open-core (MIT + paid Pro features)** — would require maintaining two builds and a Pro proprietary layer; the OSS funnel is valuable but the user is not seeking community management.
2. **Recurring subscription** — dissonant with the "anti-subscription" framing; also a losing battle to undercut Notion ($10/user/mo) at scale.
3. **Source-available + one-time purchase** — buyer receives the source via a private repo; the source delivery *is* the trust signal; one-time pricing reinforces the "own it" pitch.

Option 3 won because it is the *cheapest in terms of code intrusion* (no entitlements service, no recurring-billing state machine) and the *most coherent* with the product's promise.

## Decisions

### 1. License: Commercial EULA, Not OSS

The codebase is no longer MIT. A custom commercial source-available license replaces it. The license grants the buyer the right to:
- Run the software on their own instances (no seat limit at launch — see ADR-003).
- Modify the source for their own internal use.
- Make backups.

And forbids:
- Redistribution of the source or binaries to third parties.
- Operating the software as a hosted service offered to third parties (i.e., reselling as a managed SaaS).

We deliberately avoid BSL / FSL / Elastic License at this stage — they are over-engineering for a single-author commercial product. A plain commercial EULA is shorter, clearer, and uncontroversial in this market segment (Tailwind UI, Nuxt UI Pro v1, Sidekiq Pro all use comparable terms).

### 2. Distribution: Polar with GitHub Repository Benefit

Polar (polar.sh) is the payment processor of record:

- One product on Polar: **"Notara Self-Host"**.
- **GitHub Repository Access** attached as a benefit — Polar adds the buyer as a collaborator to the private repo automatically upon successful payment.
- Polar acts as merchant of record (VAT handled).
- Fees ~4% + 0.40$/transaction, lower than Lemon Squeezy.

This removes the need to write any custom webhook plumbing for delivery. The "buy → get code" loop is fully managed by Polar.

### 3. Pricing: One-Time, Early-Bird Anchored Low

- **Early-bird (first 100 buyers or first 3 months):** 19€ one-time, lifetime updates.
- **Standard price after early-bird:** 39–49€ one-time, lifetime updates.
- No subscription. No recurring revenue at launch.

Marketing anchor: "less than 5 months of Notion, then yours forever."

Rationale: the Notion-alt market (productivity / second-brain) has a much lower price ceiling than developer tools — comparables sit at $30–50 for one-time, not $200+. Starting low at launch maximizes signal and testimonials; the price can rise as social proof accumulates.

### 4. Cloud Managed Offering: Deferred

A hosted/managed cloud version is **explicitly out of scope** for the initial launch. The self-host one-time validates demand first. If demand for managed hosting emerges, it slots in cleanly later (same codebase, same `workspaces` table — only a Stripe-style recurring subscription needs to be added on top of the existing Polar self-host product).

### 5. Repo Privacy

The Git repository is private. There is no Community Edition fork. The MIT-licensed history is removed from `LICENSE` and replaced with the EULA going forward; any prior MIT commits are immaterial because the repo was never published.

## Consequences

**Positive**
- **Zero gating code at launch.** No entitlements service, no plan column, no Stripe webhook custom logic. The "billing feature" is a license file and a Polar product.
- **Support load is bounded.** Only paying customers can open issues — they are by definition motivated and small in number.
- **Pricing power is independent of Notion's subscription floor.** We are selling a different promise, not a cheaper version.
- **Optionality preserved.** Adding Team tier, Cloud managed, or feature-gated Pro tier later is all reachable from this base without breaking decisions made now.

**Negative**
- No OSS community / GitHub stars funnel. Acquisition will rely on content marketing, demos, and direct outreach.
- Piracy is structurally possible (any source-available product can leak). This is acceptable in this market — pirates do not convert to buyers.
- Trust must be established without the social proof of public stars/contributors. Compensated by transparent roadmap, demo, and a clear face behind the product.

## Implementation

See plan in `docs/plans/` and ADR-003 for the tier structure follow-up. Concretely:

1. Replace `/LICENSE` (MIT) with `/LICENSE` (commercial EULA).
2. Set repo to private on GitHub.
3. Create Polar organization + product with GitHub Repository Benefit.
4. Update `LandingPage` pricing section to point at the Polar checkout URL.
5. The rest of the launch checklist (onboarding, observability, email verification) is independent of the commercial wrapper — see plan.
