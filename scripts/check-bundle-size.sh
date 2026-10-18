#!/usr/bin/env bash
# ── Bundle-size check ────────────────────────────────────────────────────────
# Builds the app + shared packages, measures output sizes, and compares them
# against the stored baseline in .github/bundle-sizes.json. Fails if any tracked
# file grows by more than the threshold (default 10%).
#
# Two ways this used to pass without measuring anything. Both are fixed here,
# and both had the same shape: the failure mode was silence.
#
#  1. The baseline was keyed by content-hashed filenames (`index-jTfcDRQW.css`).
#     Every code change mints a new hash, so every entry became "MISSING" and
#     was skipped — this check ran only when nothing had changed. Entries are
#     keyed by a logical name now (`index.css`), and the hashed file the current
#     build produced is found by glob.
#  2. The threshold arithmetic used `bc`, which devenv.nix does not provide, and
#     the expression ended in `|| echo 0`. Growth was therefore always 0 and the
#     comparison could never trip. It is awk now, and a tracked asset that cannot
#     be found FAILS rather than warns — an asset nobody measured is not a pass.
#
# Usage:  bash scripts/check-bundle-size.sh [threshold_percent]

set -euo pipefail

THRESHOLD="${1:-10}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$ROOT/.github/bundle-sizes.json"
PASS=0
FAIL=0

echo "→ Building packages…"
(cd "$ROOT/packages/shared" && bun run build >/dev/null 2>&1)
(cd "$ROOT/packages/app" && bun run build >/dev/null 2>&1)

gzip_size() {
  gzip -c "$1" | wc -c | tr -d ' '
}

# A built asset is `index-<hash>.js`; the baseline names it `index.js`. Find
# whichever file the current build produced for a logical name.
resolve() {
  local logical="$1" dir base ext found
  if [ -f "$ROOT/$logical" ]; then
    printf '%s' "$ROOT/$logical"
    return 0
  fi
  dir="$(dirname "$logical")"
  ext="${logical##*.}"
  base="$(basename "$logical" ".$ext")"
  found="$(ls "$ROOT/$dir/$base"-*."$ext" 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    printf '%s' "$found"
    return 0
  fi
  return 1
}

# Growth as a percentage, absolute. awk, not bc: a tool that is not installed
# must not read as "no growth".
growth_pct() {
  awk -v actual="$1" -v base="$2" 'BEGIN {
    if (base <= 0) { print "n/a"; exit }
    p = ((actual - base) / base) * 100
    if (p < 0) p = -p
    printf "%.2f", p
  }'
}

echo "→ Checking bundle sizes (threshold: ${THRESHOLD}%)…"

while IFS= read -r tracked; do
  logical=$(echo "$tracked" | jq -r '.file')
  baseline_size=$(echo "$tracked" | jq -r '.size // 0')

  if ! path=$(resolve "$logical"); then
    echo "  ✗ $logical — NOT FOUND in the build; nothing was measured"
    FAIL=$((FAIL + 1))
    continue
  fi

  actual_size=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path")
  actual_gzip=$(gzip_size "$path")
  pct=$(growth_pct "$actual_size" "$baseline_size")

  if [ "$pct" = "n/a" ]; then
    echo "  ✗ $logical — baseline size is 0, growth cannot be judged"
    FAIL=$((FAIL + 1))
  elif awk -v p="$pct" -v t="$THRESHOLD" 'BEGIN { exit !(p > t) }'; then
    echo "  ✗ $logical — ${actual_size}B gz${actual_gzip}B (baseline ${baseline_size}B, +${pct}% over ${THRESHOLD}%)"
    FAIL=$((FAIL + 1))
  else
    echo "  ✓ $logical — ${actual_size}B gz${actual_gzip}B (baseline ${baseline_size}B, +${pct}%)"
    PASS=$((PASS + 1))
  fi
done < <(jq -c 'to_entries | map(select(.key != "timestamp")) | .[] | {file: .key, size: .value.size}' "$BASELINE")

echo ""
echo "→ Result: ${PASS} passed, ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
  echo "✗ Bundle-size check FAILED" >&2
  exit 1
fi
echo "✓ Bundle-size check passed"
