#!/usr/bin/env bash
# Check that every Zustand store with async RPC calls has error handling.
# Simple heuristic: if a store has "await api." it should also have a try block.
# AC #3 for NOT-70: runs as part of the lint/CI pipeline.
set -euo pipefail

echo "🔍 Checking for unhandled RPC errors in Zustand stores..."
echo ""

PASS=true

for store in packages/app/src/stores/*.ts; do
  name=$(basename "$store" .ts)
  if grep -q "await api\." "$store" 2>/dev/null; then
    if ! grep -q "\btry\b" "$store" 2>/dev/null; then
      echo "  ❌ $name has await api.* calls with zero error handling"
      PASS=false
    fi
  fi
done

echo ""

if [ "$PASS" = false ]; then
  echo "❌ Some Zustand stores have no error handling at all."
  echo "   Add try/catch around async operations."
  exit 1
fi

echo "✅ All Zustand stores with RPC calls have error handling."
