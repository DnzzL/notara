---
name: implement
description: Pick a task marked ready for agent, implement it, and advance it to done or needs human validation. Use when the user wants to execute work from the backlog.
---

# Implement

Take a well-defined task and ship it.

## Workflow

1. **List what's ready** — `backlog task list -s "ready for agent" --plain`
2. **Pick one** — the user tells you which, or take the highest-priority unstarted task.
3. **Read the task** — `backlog task NOT-NNN --plain` for full context (description, ACs, notes).
4. **Implement** — explore the codebase, write code, run tests.
5. **Commit** — `git add -A && git commit -m "<type>: <description> (NOT-NNN)"`
   where `<type>` matches conventional commits (`fix`, `feat`, `test`, `chore`, etc.).
6. **Mark done** — `backlog task edit NOT-NNN -s "done" --check-ac 1 --check-ac 2`
   (check each acceptance criterion that passes).

## If you get stuck

If during implementation you hit an ambiguity, missing context, or a decision you shouldn't make:

```
backlog task edit NOT-NNN -s "needs human validation" --append-notes "What's unclear: ..."
```

Then stop and tell the user what you found. Don't guess.

## Scope rule

One task per session. If you discover related work that should be a separate task, mention it —
don't implement it inline. The user can triage it separately.

## Verification checklist

Before marking done:

- [ ] All listed acceptance criteria are met
- [ ] Existing tests still pass: `bun --bun tsc --noEmit -p packages/server` and
      `bun test packages/server/test`
- [ ] You've noted anything useful back in the task: `backlog task edit NOT-NNN --append-notes "..."`
