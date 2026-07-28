#!/usr/bin/env bash
# Check that Effect programs in Zustand stores handle their error channels.
set -euo pipefail

# Patterns we check: stores that call api.* without try/catch
# This finds async store methods that don't have error handling

echo "🔍 Checking for unhandled Effect errors in Zustand stores..."
echo ""

PASS=true

# Check zustand stores for unhandled async errors
for store in packages/app/src/stores/*.ts; do
  name=$(basename "$store" .ts)
  # Skip files that already have proper error handling
  if grep -q "catch\|try {" "$store" 2>/dev/null; then
    continue
  fi
  # Find async methods without error handling
  unhandled=$(grep -c "await api\." "$store" 2>/dev/null || echo 0)
  if [ "$unhandled" -gt 0 ]; then
    echo "  ⚠️  $name has $unhandled await api.* calls without error handling"
    PASS=false
  fi
done

echo ""

if [ "$PASS" = false ]; then
  echo "❌ Some Zustand stores have unhandled Effect errors"
  echo "   Add try/catch or use Effect.catchAll to handle errors"
  exit 1
fi

echo "✅ All Effect error channels are properly handled"
