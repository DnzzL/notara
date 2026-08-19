# ADR-004: Fair-Source Relicense — FSL-1.1-ALv2, Retiring the One-Time Commercial Model

**Status:** Superseded by [ADR-005](./005-agpl.md) on 2026-08-19
**Date:** 2026-07-01
**Scope:** Licensing, distribution, and revenue posture. Supersedes ADR-002 and ADR-003.

## Context

ADR-002 committed Notara to a commercial source-available EULA sold as a €29 one-time purchase, delivered via Polar's GitHub Repository Benefit, capped at the first 500 buyers. ADR-003 layered a single-tier launch on top, deferring any Team tier and any entitlements code.

Since then the honest reassessment is that **direct monetization of a self-hosted Notion alternative is unlikely to succeed** at a scale that justifies the commercial wrapper. The one-time model has a low ceiling by construction (500 × €29 ≈ €14.5k) and the private-repo/Polar machinery buys little when the acquisition funnel — content, demos, direct outreach — is the actual constraint, not payment plumbing.

Rather than keep a commercial gate around code that is unlikely to earn, we open it — but not naively. Plain MIT/Apache would let a competitor lift Notara into a hosted "NotaraCloud," outspend us on distribution, and return nothing to the project or its users. For a Notion alternative, a hosted free-rider is the obvious and only serious commercial threat.

The **Functional Source License (FSL)** — as used by Sentry, GitButler, and cairn (`cairnpm/cairn`) — resolves this: source-available now with a single anti-compete constraint, converting automatically to a permissive OSS license after two years per release.

## Decision

### 1. License: FSL-1.1-ALv2

Relicense the entire codebase under **FSL-1.1-ALv2** (Functional Source License 1.1, Apache 2.0 future license):

- **Free to self-host, run, modify, and redistribute** for any purpose *except* offering Notara (or a derivative) as a commercial hosted service that competes with the project.
- **Two-year tail:** each released version automatically becomes **Apache-2.0** two years after its release date. The code is genuinely, permanently open — just not immediately exploitable by a competing SaaS.

The commercial EULA from ADR-002 is retired. The `first-500 / €29 / €49–59` pricing is retired. Polar and the GitHub Repository Benefit are retired.

### 2. Repo goes public

The repository becomes public source-available under FSL. There is no private-repo delivery mechanism because possession is no longer the entitlement.

### 3. Revenue lever relocated, not deleted — reserved, not built

We are **not** committing to monetization, but we deliberately preserve the option at zero present cost:

- The **core always runs free, without any license key.** This is non-negotiable and matches the local-first, single-instance posture.
- A **future Team/org tier** (e.g. SSO, multi-workspace) *may* later require a license key. FSL's terms permit reserving this; the two-year tail does not force us to open the Team layer on the same clock if it is a separate proprietary addition.
- If that tier ever lands, its gate lives **only** at the seat-add seam already identified in ADR-003 (`Workspaces.inviteMemberByEmail`, `Workspaces.joinWorkspaceByToken`) — never scattered across handlers. The FSL decision and the existing architecture agree on this point.

No entitlements service, no `workspaces.plan` column, no gating code ships as part of this ADR. The reservation is contractual (license text) and architectural (the known seam), not runtime.

## Why

- **The code is unlikely to earn, so keep it earning goodwill instead.** Public source-available maximizes adoption and trust — the thing we actually lack — while the two-year tail satisfies most of the "that's not real open source" objection.
- **FSL protects the one real threat.** The anti-compete clause blocks a hosted free-rider without restricting any genuine user, who can always self-host freely.
- **Strictly more optionality than plain OSS.** "Unlikely to monetize" is a prediction, not a fact. FSL lets us be wrong about it later — a permissive license would not. Choosing FSL over MIT/Apache costs nothing today and keeps the Team-tier door open.
- **Coherent with the codebase.** The reserved Team seam is exactly what ADR-003 already anticipated; nothing about the current architecture fights this decision.

## Consequences

**Positive**
- Public repo: stars/contributors funnel, transparent roadmap, real adoption path.
- Free-rider protection without user-facing restriction.
- Genuine long-term openness via the Apache-2.0 tail.
- Zero runtime billing/gating code, same as before.

**Negative**
- **No revenue at launch, by choice.** The €29 income path is gone; nothing replaces it now.
- FSL is *not* OSI-approved "open source" during the two-year window — some FOSS purists will object; the tail blunts but does not eliminate this.
- Piracy is moot (source is public) but so is any paid moat until/unless a Team tier is built.

## Implementation

1. Replace `/LICENSE` (commercial EULA) with the **FSL-1.1-ALv2** text (from fsl.software), setting the correct copyright line and per-release change date.
2. Add a short "License" section to `README` explaining free self-host + the two-year Apache tail + the single no-competing-SaaS constraint.
3. Rewrite `LandingPage.tsx`: remove €29 pricing, the 500-buyer cap, and the Polar checkout; replace with a "free, self-hostable, source-available" CTA pointing at the public repo.
4. Retire the Polar product and GitHub Repository Benefit (external, no code).
5. Review `/privacy` and `/terms` for references to the commercial EULA / purchase flow and update to match a free self-host posture.
6. Set the GitHub repo to public.

## Related

- Supersedes the retired €29 commercial model (ADR-002 + ADR-003, kept as private local notes).
- Reference model: `cairnpm/cairn` (FSL-1.1-ALv2, free core, reserved Team key).
- The seat-add gating seam for any future Team tier is described in `CLAUDE.md` §5.
