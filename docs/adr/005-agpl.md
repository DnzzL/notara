# ADR-005: Relicense to AGPL-3.0-or-later — Trading a Hypothetical Moat for Real Distribution

**Status:** Accepted
**Date:** 2026-08-19
**Scope:** Licensing and distribution posture. Supersedes ADR-004.

## Context

ADR-004 relicensed Notara to FSL-1.1-ALv2 on the reasoning that plain MIT/Apache would let
a competitor lift it into a hosted "NotaraCloud", and that FSL costs nothing today while
keeping a Team-tier door open. That ADR simultaneously recorded the opposite finding:
*"direct monetization of a self-hosted Notion alternative is unlikely to succeed"*, and
that the real constraint is *"the acquisition funnel — content, demos, direct outreach"*.

Both halves can't be load-bearing. If distribution is the binding constraint and revenue is
judged unlikely, then a licence that trades distribution for anti-compete protection is
priced backwards. Concretely, FSL costs:

- **Exclusion from OSI-gated catalogues** — `awesome-selfhosted` and similar require an
  open-source licence. For a self-hosted app those lists are a top-tier discovery channel.
- **A paragraph to defend in every launch thread.** "Not real open source" is the first
  comment on HN and Reddit, and answering it consumes the attention the post was for.
- **A "source available" asterisk** on every directory listing and in every write-up.

And it buys protection against a scenario — a funded competitor reselling a one-person
SQLite notes app as a SaaS — whose probability and damage are both close to zero, and whose
protection expires two years per release anyway.

## Decision

Relicense to **AGPL-3.0-or-later**, effective from `v0.1.3`. Releases up to and including
`v0.1.2` shipped under FSL-1.1-ALv2 and keep those terms (with their two-year Apache-2.0
tail); nothing is retracted from anyone who already received them.

### Why AGPL rather than Apache or MIT

**As sole copyright holder, AGPL keeps nearly all the optionality FSL was bought for.**
Copyleft binds licensees, not the copyright holder: a hosted Notara, a dual-licensed
commercial edition, or a proprietary Team add-on all remain available without anyone's
permission. What AGPL gives up versus FSL is only the ability to stop a *compliant*
competitor — one who publishes their modifications — which is precisely the low-probability,
low-damage case.

What AGPL keeps that MIT/Apache would not: an operator who forks Notara, improves it, and
runs it as a closed service over a network must release those modifications. That is the
whole of the free-rider deterrent that actually matters here, and it is enforced by a
licence every self-hoster already recognises.

### Contribution terms

**Inbound equals outbound, no CLA, no copyright assignment.** Contributions are licensed
AGPL-3.0-or-later, with an optional DCO sign-off.

The consequence is accepted knowingly: without a CLA, dual-licensing later would need the
consent of anyone whose code is still in the tree. Given the solo posture — new features
need an approved issue first, and the feature list is short on purpose — asking a handful of
contributors is cheaper than making every contributor sign a CLA to protect a revenue path
this ADR already calls unlikely.

### What is retired

The Team-tier reservation from ADR-003/ADR-004 is no longer a *licensing* construct. If a
Team tier is ever built it will be a dual-licensing or separate-add-on decision, still gated
only at the seat-add seam (`withAuthedWorkspace`), and still not present in the runtime
today.

## Consequences

**Positive**
- Genuinely open source: OSI-approved, catalogue-eligible, no asterisk.
- The launch conversation is about the product instead of the licence.
- Closed-source hosted forks still have to give their changes back.

**Negative**
- **Third licence change in two months** (ADR-002 → 003 → 004 → 005). Mitigated by doing it
  *before* the launch push rather than after, and by leaving this trail rather than editing
  the past.
- Some organisations ban AGPL internally. Accepted: corporate procurement is not the
  audience for a solo self-hosted notes app.
- No CLA means dual-licensing later is a conversation, not a unilateral act.

## Implementation

1. `LICENSE` ← verbatim GNU AGPL v3 text; add `COPYRIGHT` with the standard notice.
2. README: badge, intro line, License section (including which releases carry which terms).
3. `CONTRIBUTING.md` and the PR template: inbound = AGPL-3.0-or-later, DCO optional, no CLA.
4. `LandingPage.tsx`, `routes/terms.tsx`: replace fair-source framing and the Apache-2.0
   tail with the AGPL one.
5. `CLAUDE.md` §5: restate the settled posture.
6. AGPL §13 wants remote users to be able to reach the source. The landing page links the
   repository; surfacing it from inside the app is tracked separately.

## Related

- Supersedes ADR-004 (FSL-1.1-ALv2), which supersedes the retired €29 commercial model
  (ADR-002 + ADR-003, kept as private local notes).
- Prior art for the shape: Immich, Mastodon and Nextcloud all pair AGPL with a
  self-hosted-first posture.
