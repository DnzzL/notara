<!--
Thanks for the PR! A few quick things so review goes fast.
See CONTRIBUTING.md for the full policy.
-->

## What & why

<!-- What does this change, and what problem does it solve? -->

## Type of change

- [ ] Bug fix
- [ ] Docs / typo
- [ ] New feature or behavior change

## For features / behavior changes

Notara features must be validated in an issue **before** they're built.

Approved issue: #<!-- issue number -->

- [ ] This change was discussed and approved in the linked issue before I wrote the code.

<!-- Bug fixes and docs edits can leave the two lines above blank. -->

## Checklist

- [ ] `bun test` passes
- [ ] `bun --bun tsc --noEmit -p packages/server` and `-p packages/app` are clean (ignoring pre-existing errors)
- [ ] Changes are surgical — no unrelated refactors or reformatting
- [ ] I agree my contribution is licensed under AGPL-3.0-or-later (see CONTRIBUTING.md)
