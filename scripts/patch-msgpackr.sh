#!/usr/bin/env bash
# Fix for @effect/platform@0.96.1 + msgpackr@1.11.x on Bun 1.3.x
# Bun caches ESM modules internally - filesystem patches to MsgPack.js are ignored.
# Since the project uses JSON RPC serialization (layerJson), MsgPack is never called.
# Solution: Comment out the MsgPack export in index.js so it never gets loaded.
set -euo pipefail

# Find the platform package index.js
INDEX_JS=""
for dir in node_modules/.bun/@effect+platform@*/node_modules/@effect/platform; do
  if [ -f "$dir/dist/esm/index.js" ]; then
    INDEX_JS="$dir/dist/esm/index.js"
    break
  fi
done

if [ -z "$INDEX_JS" ] || [ ! -f "$INDEX_JS" ]; then
  echo "WARN: @effect/platform index.js not found"
  exit 0
fi

if grep -q 'export \* as MsgPack from "./MsgPack.js"' "$INDEX_JS" 2>/dev/null; then
  sed -i 's|export \* as MsgPack from "./MsgPack.js";|// export * as MsgPack from "./MsgPack.js"; // disabled - msgpackr incompatible with Bun 1.3.x (project uses JSON RPC)|' "$INDEX_JS"
  echo "Patched $INDEX_JS - commented out MsgPack export"
else
  echo "MsgPack export already disabled"
fi
