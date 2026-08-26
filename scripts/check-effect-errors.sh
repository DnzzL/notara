#!/usr/bin/env bash
# Every RPC call in a Zustand store must have a failure path.
#
# A rejected promise in a store changes nothing on screen and says nothing to
# the user: an action that failed is indistinguishable from one that was never
# attempted. AC #3 for NOT-70; the failure it exists to catch is NOT-125.
#
# The check is per CALL, not per file. The previous version asked only whether a
# store contained the word "try" anywhere, which was wrong in both directions:
# databaseStore passed for years on a `try` belonging to a JSON.parse while all
# nineteen of its API calls were bare, and then failed once that handling was
# correctly factored into lib/storeErrors.ts.
#
# A call counts as handled when it is either wrapped in one of the shared
# helpers (guarded / reported) or sits inside a try block in the same file. The
# second form is what blockStore and apiKeyStore still use.
set -euo pipefail

echo "🔍 Checking for unhandled RPC calls in Zustand stores..."
echo ""

PASS=true

for store in packages/app/src/stores/*.ts; do
  name=$(basename "$store" .ts)

  total=$(grep -c "await api\." "$store" 2>/dev/null || true)
  [ "${total:-0}" -eq 0 ] && continue

  # Calls routed through the shared helpers, which own the try/catch.
  helped=$(grep -c "guarded(\|reported(" "$store" 2>/dev/null || true)

  # Calls covered by a try block in this file. The state machine matters: a
  # `try` elsewhere in the file must not vouch for an unrelated call, which is
  # precisely how the previous version of this check passed on databaseStore.
  #
  # No \b in the patterns — BSD awk (macOS) does not support it, and silently
  # matching nothing there while matching in CI is the worst way for a guard to
  # be wrong.
  in_try=$(awk '
    /^[[:space:]]*try[[:space:]]*\{/  { depth++ }
    /^[[:space:]]*\}[[:space:]]*catch/ { if (depth > 0) depth-- }
    /await api\./                     { if (depth > 0) n++ }
    END { print n + 0 }
  ' "$store")

  covered=$((helped + in_try))

  if [ "$covered" -lt "$total" ]; then
    echo "  ❌ $name: $((total - covered)) of $total RPC calls have no failure path"
    echo "     Wrap them in guarded() or reported() from lib/storeErrors.ts."
    PASS=false
  fi
done

echo ""

if [ "$PASS" = false ]; then
  echo "❌ Some RPC calls fail silently: the user sees nothing happen."
  exit 1
fi

echo "✅ Every RPC call in a Zustand store has a failure path."
