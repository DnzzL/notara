# Plan 002: Reconcile "real-time collaboration" launch copy with what the code does

> **Executor instructions**: This plan contains a **decision the maintainer must
> make** (Step 0) before any code edit. If the decision in Step 0 has not been
> recorded, STOP and ask — do not pick a framing yourself. Once the framing is
> chosen, apply the copy edits, run verification, and update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 425b8e2..HEAD -- packages/app/src/components/LandingPage.tsx`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `425b8e2`, 2026-06-18

## Why this matters

The landing page promises **"real-time collaboration"** (`LandingPage.tsx:117`)
and that teammates can *"edit alongside them without stepping on each other's
work"* (`LandingPage.tsx:28`). The actual implementation
(`packages/server/src/presence/`) is **live presence + soft block-focus locks**
(~10s TTL), not Google-Docs-style concurrent text merging. There is intentionally
**no CRDT**: the block-per-editor architecture is a settled decision and a
single-document/CRDT migration is explicitly off the table (project memory
`editor_block_per_editor_decision`). So the gap is not an engineering bug to fix
by building co-editing — it is a **marketing claim that overstates the mechanism**
a buyer will test on day one. Two users on the same page will see each other's
presence and be prevented from clobbering the same block, but they will not see
each other's keystrokes stream in live. The fix is to make the copy precise so the
product over-delivers rather than under-delivers at launch.

## Current state

`packages/app/src/components/LandingPage.tsx` — relevant copy as it exists today:

- Line 27-28 (a feature-card object):
  ```ts
  title: "Work with your team",
  desc: "Invite teammates, see who's on the page, and edit alongside them without stepping on each other's work.",
  ```
  This sentence is **accurate** — presence ("see who's on the page") + soft locks
  ("without stepping on each other's work") describe exactly what exists. It likely
  needs no change; confirm during Step 0.

- Line 115-119 (hero paragraph):
  ```tsx
  A Notion alternative you can touch. Desktop app, block editor,
  inline databases, real-time collaboration — all backed by a single SQLite
  file on your own server. Pay once. Keep the source. Walk away whenever you like.
  ```
  The phrase **"real-time collaboration"** is the overclaim — it reads as live
  co-editing.

What the code actually provides (for grounding the rewrite — do not quote verbatim
into copy): heartbeat presence with live avatars (`packages/app/src/components/PresenceAvatars.tsx`,
`packages/server/src/presence/PresenceService.ts`), an SSE stream
(`/api/presence/stream`), and block-focus soft locks with a ~10s TTL. There is no
operational-transform or CRDT layer.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| App typecheck (baseline) | `bun --bun tsc --noEmit -p packages/app 2>&1 \| sort > /tmp/tsc-app-before.txt` | captures pre-existing errors |
| App typecheck (after) | `bun --bun tsc --noEmit -p packages/app 2>&1 \| sort > /tmp/tsc-app-after.txt` | diff vs before is empty |

> `packages/app` has pre-existing TS errors that are not yours (`CLAUDE.md` §3).
> The done-criterion is **no new errors**, not zero errors. This plan only changes
> string literals, so the diff should be empty.

## Scope

**In scope** (the only file you should modify):
- `packages/app/src/components/LandingPage.tsx` — hero copy (and the feature card
  only if Step 0 decides it needs softening)
- Optionally `docs/adr/004-collaboration-positioning.md` — **create**, only if the
  maintainer asks to record the decision (see Step 0)

**Out of scope** (do NOT touch):
- Anything under `packages/server/src/presence/` or the editor — this plan does
  **not** change behavior, only copy. Do **not** start building CRDT/co-editing;
  that is an explicitly rejected direction (see `plans/README.md`).
- Pricing, the buyer cap, or any other landing section.

## Git workflow

- Branch: `advisor/002-collab-positioning`
- Conventional Commits; e.g. `docs(landing): clarify collaboration claim to match presence model`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 0 (DECISION — required before any edit)

The maintainer chooses ONE framing. **Recommended: Option A.** If no choice is on
record, STOP and ask which option to apply.

- **Option A — Soften the hero claim (recommended, ~0 risk).** Replace
  "real-time collaboration" with language that describes presence + edit-safety
  honestly, e.g. *"live presence & collaborative editing"* or *"real-time presence,
  edit together safely"*. Keep the line 28 feature card as-is (it's already
  accurate). This makes the product over-deliver.
- **Option B — Keep the claim, accept it.** Decide that "real-time collaboration"
  fairly describes presence + locks and make no change. (Then this plan closes as
  REJECTED with that rationale — record it in `plans/README.md`.)
- **Option C — Build true co-editing.** Out of scope here and contradicts the
  settled block-per-editor decision. If seriously considered, it needs its own
  audit/ADR, not this plan. Do **not** pursue under this plan.

### Step 1 (Option A only): Edit the hero copy

In `packages/app/src/components/LandingPage.tsx:116-117`, change the phrase
`real-time collaboration` within the hero paragraph to the maintainer-approved
wording from Step 0 (default: `live presence & collaborative editing`). Change
**only** that phrase; leave the surrounding sentence and markup intact.

If Step 0 also flagged the line 28 feature card for softening, apply the approved
wording there too; otherwise leave it.

**Verify**:
- `grep -n "real-time collaboration" packages/app/src/components/LandingPage.tsx`
  → no matches (the overclaiming phrase is gone), unless Step 0 chose Option B.
- `bun --bun tsc --noEmit -p packages/app 2>&1 | sort > /tmp/tsc-app-after.txt`
  then `diff /tmp/tsc-app-before.txt /tmp/tsc-app-after.txt` → empty (no new errors).

### Step 2 (optional): Record the decision

If the maintainer asks, create `docs/adr/004-collaboration-positioning.md`
following the existing ADR format (see `docs/adr/003-single-tier-launch.md` for
structure: Status / Date / Scope / Context / Decision / Consequences). State that
collaboration is presence + soft locks (no CRDT), why (block-per-editor is settled),
and how the landing copy reflects that. Skip this step if not requested.

## Test plan

No automated tests — this is copy. Verification is the `grep` + typecheck-diff in
Step 1 plus a visual check of the hero section in `bun run dev:app` if available.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] A Step 0 decision is on record (in the commit message or the PR description).
- [ ] If Option A: `grep -n "real-time collaboration" packages/app/src/components/LandingPage.tsx` returns no matches.
- [ ] `diff /tmp/tsc-app-before.txt /tmp/tsc-app-after.txt` is empty (no new TS errors).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row for 002 updated (DONE, or REJECTED if Option B).

## STOP conditions

Stop and report back (do not improvise) if:

- No Step 0 decision is recorded — ask which option to apply.
- The hero paragraph at `LandingPage.tsx:115-119` doesn't match the excerpt (drift).
- You find yourself tempted to change presence/editor *behavior* — that is out of
  scope and contradicts a settled architectural decision; stop.

## Maintenance notes

- If true concurrent co-editing is ever built (a large, separate effort that would
  revisit the block-per-editor decision), this copy can be upgraded back to
  "real-time collaboration" honestly — and ADR-004 (if created) should be superseded.
- Reviewer should confirm this PR contains **only** string changes and no
  presence/editor logic was touched.
