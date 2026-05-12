#!/usr/bin/env bash
# Fix for @effect/platform@0.96.1 + msgpackr@1.11.x on Bun 1.3.x
# Bun caches ESM modules internally - filesystem patches to MsgPack.js are ignored.
# Since the project uses JSON RPC serialization (layerJson), MsgPack is never called.
# Solution: Comment out the MsgPack export in index.js so it never gets loaded.
set -euo pipefail

# Find the platform package index.js
INDEX_JS=""
MSGPACK_JS=""
for dir in node_modules/.bun/@effect+platform@*/node_modules/@effect/platform; do
  if [ -f "$dir/dist/esm/index.js" ]; then
    INDEX_JS="$dir/dist/esm/index.js"
  fi
  if [ -f "$dir/dist/esm/MsgPack.js" ]; then
    MSGPACK_JS="$dir/dist/esm/MsgPack.js"
  fi
done

if [ -z "$INDEX_JS" ] || [ ! -f "$INDEX_JS" ]; then
  echo "WARN: @effect/platform index.js not found"
else
  if grep -q 'export \* as MsgPack from "./MsgPack.js"' "$INDEX_JS" 2>/dev/null; then
    # Cross-platform sed -i (works on both macOS and Linux)
    sed -i.bak 's|export \* as MsgPack from "./MsgPack.js";|// export * as MsgPack from "./MsgPack.js"; // disabled - msgpackr incompatible with Bun 1.3.x (project uses JSON RPC)|' "$INDEX_JS" && rm -f "$INDEX_JS.bak"
    echo "Patched $INDEX_JS - commented out MsgPack export"
  else
    echo "MsgPack export already disabled"
  fi
fi

# Fix: Add Msgpackr re-export to MsgPack.js for @effect/rpc compatibility
# @effect/rpc imports { Msgpackr } from @effect/platform/MsgPack but it's not exported
if [ -n "$MSGPACK_JS" ] && [ -f "$MSGPACK_JS" ]; then
  if ! grep -q 'export \* as Msgpackr from "msgpackr"' "$MSGPACK_JS" 2>/dev/null; then
    echo '' >> "$MSGPACK_JS"
    echo '// Added for @effect/rpc compatibility with Bun' >> "$MSGPACK_JS"
    echo 'export * as Msgpackr from "msgpackr";' >> "$MSGPACK_JS"
    echo "Patched $MSGPACK_JS - added Msgpackr re-export"
  else
    echo "Msgpackr re-export already present"
  fi
else
  echo "WARN: @effect/platform MsgPack.js not found"
fi
