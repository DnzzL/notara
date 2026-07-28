#!/usr/bin/env bash
# ── Bundle-size check ────────────────────────────────────────────────────────
# Builds the app + shared packages, measures output sizes, and compares
# against the stored baseline in .github/bundle-sizes.json.
# Fails if any tracked file grows by more than the threshold (default 10%).
#
# Usage:  bash scripts/check-bundle-size.sh [threshold_percent]

set -euo pipefail

THRESHOLD="${1:-10}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$ROOT/.github/bundle-sizes.json"
PASS=0
FAIL=0

# 1. Build shared + app
echo "→ Building packages…"
cd "$ROOT/packages/shared" && bun run build >/dev/null 2>&1
cd "$ROOT/packages/app" && bun run build >/dev/null 2>&1

# 2. Tool to compute gzip size (use bun or gzip)
gzip_size() {
  local f="$1"
  if command -v gzip &>/dev/null; then
    gzip -c "$f" | wc -c | tr -d ' '
  else
    echo 0
  fi
}

# 3. Compare each tracked file
echo "→ Checking bundle sizes (threshold: ${THRESHOLD}%)…"

while IFS= read -r tracked; do
  file=$(echo "$tracked" | jq -r '.file')
  baseline_size=$(echo "$tracked" | jq -r '.size // 0')
  baseline_gzip=$(echo "$tracked" | jq -r '.["gzip"] // 0')

  if [ ! -f "$ROOT/$file" ]; then
    echo "  ⚠ $file — MISSING (not built?)"
    continue
  fi

  actual_size=$(stat -f%z "$ROOT/$file" 2>/dev/null || stat -c%s "$ROOT/$file" 2>/dev/null)
  actual_gzip=$(gzip_size "$ROOT/$file")

  pct=$(echo "scale=2; (($actual_size - $baseline_size) / $baseline_size) * 100" | bc 2>/dev/null || echo 0)
  pct="${pct#-}" # absolute value

  if [ "$(echo "$pct > $THRESHOLD" | bc 2>/dev/null)" = "1" ] && [ "$baseline_size" -gt 0 ]; then
    echo "  ✗ $file — ${actual_size}B (baseline ${baseline_size}B, +${pct}%)"
    FAIL=$((FAIL + 1))
  else
    echo "  ✓ $file — ${actual_size}B (baseline ${baseline_size}B, +${pct}%)"
    PASS=$((PASS + 1))
  fi
done < <(jq -c 'to_entries | map(select(.key != "timestamp")) | .[] | {file: .key, size: .value.size, gzip: .value.gzip}' "$BASELINE")

echo ""
echo "→ Result: ${PASS} passed, ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
  echo "✗ Bundle-size check FAILED — threshold exceeded" >&2
  exit 1
fi
echo "✓ Bundle-size check passed"
