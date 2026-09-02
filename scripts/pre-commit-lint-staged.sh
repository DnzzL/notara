#!/usr/bin/env bash
# ── Pre-commit lint (staged files only) ─────────────────────────────────────
# `biome check --write` on the whole tree used to re-stage every tracked
# change via `git add -u`, silently swallowing unrelated in-progress edits.
# This scopes the fix + re-add to exactly the files that were staged.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

staged_files=$(git diff --cached --name-only --diff-filter=ACMR -- packages/ e2e/)

if [ -z "$staged_files" ]; then
    exit 0
fi

bunx @biomejs/biome check --write --unsafe --staged

echo "$staged_files" | xargs -r git add
