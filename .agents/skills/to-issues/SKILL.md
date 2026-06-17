---
name: to-backlog-issues
description: Break a plan, spec, or PRD into independently-grabbable issues in backlog.md using tracer-bullet vertical slices. Project-specific variant that publishes directly to backlog.md via the backlog CLI. Use when the project uses backlog.md as its issue tracker. Use when user wants to convert a plan into issues, create implementation tickets, or break down work into issues.
---

# To Issues

Break a plan into independently-grabbable issues using vertical slices (tracer bullets).

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Publish the issues

After the user approves, detect which issue tracker the project uses and publish accordingly.

#### Detection

Check for these in order:

1. **backlog.md** — if `backlog/config.yml` or `backlog/tasks/` exists in the project root
2. **GitHub Issues** — if `.github/` or an upstream remote points to github.com

Fall back to asking the user.

---

#### Mode A: Publishing to backlog.md

Use `backlog task create` for each approved slice.

**Status assignment** (the project's status vocabulary is read from `backlog/config.yml`):

- If perimeter and acceptance criteria are **crystal clear** (well-defined scope, testable ACs, no unanswered questions) → use `ready for agent`
- If there are **pending questions, unknowns, or investigation required** → use `needs human validation`
- If unsure, default to `needs human validation` — the human can upgrade it

**Labels** come from the project's `labels` list in `backlog/config.yml`. Common labels: `bug`, `enhancement`, `frontend`, `backend`, `database`.

**Publishing command:**

```bash
backlog task create "Title" \
  -d "Description text" \
  -s "ready for agent" \
  -l "bug" \
  --ac "Acceptance criterion 1" \
  --ac "Acceptance criterion 2"
```

**Guidelines:**
- Keep descriptions concise but specific — describe the end-to-end behavior, not layer-by-layer implementation
- Avoid specific file paths or code snippets — they go stale fast
- Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note it came from a prototype
- ACs should be testable/verifiable outcomes
- If a slice is blocked by another, note it in the description and mention it when presenting to the user — backlog IDs are not known until creation time
- Publish in dependency order (blockers first) so real IDs can be referenced in later descriptions
- Do NOT close or modify any parent issue

---

#### Mode B: Publishing to GitHub Issues

Use the GitHub Issues API. For each approved slice, create a new issue with the template below. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order (blockers first) so you can reference real issue identifiers in the "Blocked by" field.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking ticket (if any)

Or "None - can start immediately" if no blockers.

</issue-template>

Do NOT close or modify any parent issue.
