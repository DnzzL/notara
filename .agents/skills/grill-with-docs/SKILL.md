---
name: grill-with-docs
description: Interview the user about a rough idea until it's well-defined enough for the backlog, then create a task — optionally straight to ready for agent if acceptance criteria are solid. Use when the user has a vague feature request, bug report, or plan that needs shaping before it can be implemented.
---

# Grill with Docs

A grilling session that takes a rough idea and turns it into a structured backlog task.
Works like the original mattpocock `grill-with-docs` but outputs are backlog tasks + optional
spec files instead of generic docs.

## When to use

Use this instead of raw `backlog task create` when the idea is:

- Vague or incomplete — "we should have dark mode"
- Potentially complex — involves multiple subsystems or tradeoffs
- Needs validation against the existing codebase — "can we just add X?"

If the idea is already well-defined (clear ACs, known scope), just create the task directly
with `backlog task create` and skip the grilling.

## Process

<grill-flow>

Interview the user relentlessly about every aspect of their idea until reaching a shared
understanding. Walk down each branch of the decision tree, resolving ambiguity one question
at a time. For each question, provide your recommended answer based on what you know.

Ask questions one at a time. Wait for feedback before continuing.

If a question can be answered by exploring the codebase, explore instead of asking.

</grill-flow>

## During the session

### Challenge against the codebase

When the user describes how something should work, check whether the current code agrees.
If you find a contradiction, surface it: "The current ACL system checks permissions at the
page level, but you're describing record-level access — which is right?"

### Sharpen fuzzy language

When the user uses vague terms, propose a precise alternative. "You're saying 'sorting' —
do you mean client-side column sort, or persisting a sort order to the database?"

### Stress-test with edge cases

Probe the idea with concrete scenarios that force precision:

- "What happens when there are 10,000 records?"
- "What if the user has no network?"
- "What if two users do this at the same time?"
- "What about the FK pragma being OFF — does this interact with that?"

### Cross-reference existing tasks

Check the backlog for related or duplicate tasks before creating a new one.
`backlog search "<keyword>" --plain`

## Outcomes

### If the idea survives grilling with clear ACs and no open questions

Auto-advance to `ready for agent`:

```bash
# Create the task
backlog task create "<title>" -s "ready for agent" --priority <low|medium|high> -l <bug|enhancement> -d "<description>" --ac "<AC 1>" --ac "<AC 2>"

# Write a spec
mkdir -p specs/NOT-NNN/
cat > specs/NOT-NNN/README.md << 'EOF'
# NOT-NNN: Title

## Behavior

Numbered testable invariants from the user's perspective.

## Acceptance criteria
- [ ] Criterion 1
```

Then link the spec: `backlog task edit NOT-NNN --notes "Spec: specs/NOT-NNN/"`

### If ambiguities remain

Create the task with the open questions captured:

```bash
backlog task create "<title>" -s "needs human validation" --priority <low|medium|high> -l <bug|enhancement> -d "<description>" --ac "<known ACs>" --notes "Open questions: ..."
```

The user can answer the questions and move it to `ready for agent` later via triage.

### If it's clearly out of scope

```bash
backlog task create "<title>" -s "wontfix" -l <bug|enhancement>
```
