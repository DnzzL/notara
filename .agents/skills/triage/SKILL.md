---
name: triage
description: Evaluate tasks in needs-triage: decide if they're ready for an agent, need human input, or should be rejected. Use when the user reports a bug, requests a feature, or wants to process the backlog.
---

# Triage

Take raw tasks and route them to the right next status. Every task carries one **category**
(`-l bug` or `-l enhancement`) and one **status**.

## Statuses

| Status | Meaning |
|---|---|
| **needs-triage** | Newly created, needs evaluation |
| **needs human validation** | Defined enough but needs a human decision |
| **ready for agent** | Fully specified, can be implemented without further input |
| **wontfix** | Will not be actioned |
| **done** | Implemented and verified |

## Decision flow

For every task you triage:

```
read the task
       │
       ▼
explore the codebase for context
       │
       ▼
 ┌─── self-sufficient? ───┐
 │                        │
 YES                      NO
 │                        │
 ▼                        ▼
ready for agent    ┌── needs human judgment?
                   │         │         │
                   YES       NO        │
                   │         │        │
                   ▼         ▼        │
            needs human   wontfix     │
            validation                │
                   │                  │
                   └──────┬───────────┘
                          ▼
                 present recommendation
                 to user, let them confirm
```

### Self-sufficient means

- The task has a clear description of what needs to change
- Acceptance criteria are concrete and testable
- No open design questions or tradeoffs that need a human call
- You can trace the relevant code paths and verify the fix is feasible

If it's self-sufficient → **recommend `ready for agent`** and optionally write a spec.

### Needs human validation

The task is real but you can't resolve it alone:
- Unclear scope or requirements
- Design tradeoff with no obvious winner
- Needs a product decision (should we do X or Y?)
- Too vague to write concrete ACs

→ **recommend `needs human validation`** with specific questions attached.

### Wontfix

Clearly out of scope, a duplicate, or not actionable:
- Already works as intended
- Not a problem worth solving
- Exact duplicate of another task

→ **recommend `wontfix`** with a brief reason.

## Commands

```bash
# List what needs triage
backlog task list -s "needs-triage" --plain

# Create a new task
backlog task create "Title" -s "needs-triage" --priority <low|medium|high> -l <bug|enhancement> -d "Description" --ac "AC 1" --ac "AC 2"

# Apply a transition
backlog task edit NOT-NNN -s "<new status>"

# Add notes
backlog task edit NOT-NNN --append-notes "decision context"

# Write a spec for a ready-for-agent task
# (creates specs/NOT-NNN/README.md with behavior + ACs)
```

Always present your recommendation to the user before applying the transition.
Let them confirm or override — then apply.
