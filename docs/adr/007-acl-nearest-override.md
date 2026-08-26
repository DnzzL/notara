# ADR-007: Page ACLs Use Nearest-Ancestor Override, Not Union Inheritance

**Status:** Accepted
**Date:** 2026-08-26
**Scope:** How a caller's effective relation on a page is resolved. Records a deliberate departure from the Zanzibar paper.

## Context

Notara's access control is Zanzibar-shaped and has been since migration `011_acl_zanzibar`:
relation tuples of `(resource, relation, subject)`, subjects that may be a user, a userset
(`workspace:<id>#member`) or `public`, one relation per subject per resource, and
per-resource revisions usable as zookies.

What was never written down is the *resolution* rule, which lived inside a `while` loop in
`resolveEffectiveRelation`. Making it declarative — the point of NOT-104 — forced the
question of which model it should be declared as, and revealed that the obvious answer
would have changed behaviour.

**The shipped rule.** Walk up from the page. The first resource carrying any tuples —
itself included — is authoritative for the whole subtree below it. The caller holds the
strongest relation among the tuples addressed to them there. If none is addressed to them,
they are **denied**, and the walk does not continue upward.

**Why that is not Zanzibar.** The paper composes relations from usersets with union,
intersection and exclusion. All three are monotonic: adding a tuple can only ever grant
more access. This rule is not. Placing a grant on a child *removes* access the child would
otherwise inherit from its parent.

The divergence is not theoretical. With a parent granting `owner` to Alice and a child
granting `owner` to Bob only:

| Model | Alice's access to the child |
| --- | --- |
| Nearest-ancestor override (shipped) | Denied — the child bears tuples and answers alone |
| Union inheritance | Allowed — `owner` inherited from the parent |

No test covered that case before this ADR, so a refactor to union rewrite rules would have
widened access on every existing install and stayed green.

## Decision

**Keep nearest-ancestor override. Declare it explicitly rather than approximate it.**

`acl.ts` states the page namespace as an ordered rule list, each rule returning one of
three decisions:

- `grant(relation)` — the caller holds this relation
- `deny` — **authoritative**; stop, do not consult later rules
- `abstain` — no opinion, ask the next rule

The rules, in precedence order: workspace owner grants `owner`; the nearest tuple-bearing
ancestor decides; a plain member with no lock above them gets `editor`. Unanimous
abstention is a refusal.

The third decision is the load-bearing part. A monotonic model needs only `grant` and
`abstain`; having `deny` in the type is what makes the departure visible in the code rather
than buried in control flow, and is what a reader needs in order to not "fix" it later.

Relation implication is likewise declared (`owner` implies `editor` implies `viewer`)
rather than compared as numeric ranks. Ranks answer "which is bigger", which is only
accidentally the same question as "does this satisfy that".

### Alternatives rejected

**Union inheritance plus an explicit `blocked` relation.** This is the canonical Zanzibar
answer, and worth being precise about: exclusion *is* in the paper, so this — not plain
union — is what "follow the spec to the letter" actually means. It preserves the ability to
restrict a subtree. It was rejected because it makes exclusion **nominative**: privatising
a page in a twenty-person workspace would mean naming all twenty exclusions, where today
placing a single grant excludes everyone else implicitly. That implicit lock is the
feature, not an accident of the implementation. Cost also included migrating stored tuples
and reworking the sharing UI.

**Plain union inheritance.** Rejected outright. It removes subtree restriction altogether
and silently widens access on existing installs at deploy time.

**Deferring to Notion's model.** Checked, and it does not settle the question. Notion's help
centre documents "the broadest level of access" about sharing *scopes* — a workspace-wide
grant beating a weaker individual one — not about the page tree, and says only that a
subpage inherits and that this can be changed. Third-party guides claim downward
restriction works. Weak and contradictory either way.

## Consequences

**Positive**
- "Make this page private" stays a one-tuple operation that scales to any workspace size.
- The rule is inspectable: reading the namespace tells you the precedence, and the
  `Decision` type tells you that a rule can refuse authoritatively.
- Relation implication has one definition instead of a rank map consulted ad hoc.

**Negative**
- **Not expressible in an off-the-shelf Zanzibar engine.** If SpiceDB, OpenFGA or Ory Keto
  is ever adopted, this rule does not port; the migration would have to convert implicit
  locks into explicit `blocked` tuples, enumerating the excluded set per locked page at
  conversion time. That conversion is possible but lossy in intent — a later-added
  workspace member would not be excluded by a converted lock the way they are today.
- Reasoning about access requires knowing the whole ancestor chain, not just the local
  tuples. That is inherent to override semantics.
- Rule order is significant. Adding a rule means deciding where it sits, and a rule that
  returns `deny` short-circuits everything after it.

**Pinned by tests**
`permissions.test.ts` covers the divergence directly: a grant on a child overrides an
inherited grant from its parent, and a locked child does not leak access to its own
children. Both were verified to fail when the authoritative `deny` is weakened to
`abstain`, so a drift toward union breaks loudly.

## Related

- Builds on migration `011_acl_zanzibar`, which established the tuple shape and revisions.
- NOT-104, whose original framing proposed union rewrite rules; corrected before
  implementation.
- ADR-006 relies on this resolution for attachments, which inherit their page's relation.
