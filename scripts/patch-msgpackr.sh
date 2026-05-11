#!/usr/bin/env bash
# Fix for @effect/platform@0.96.1 + msgpackr@1.11.x on Bun 1.3.x
# "import * as Msgpackr" doesn't work with msgpackr's re-exports in Bun.
# Patches MsgPack.js to use named imports instead.
set -euo pipefail

MSGPACK_JS=""
for dir in node_modules/@effect/platform \
           node_modules/.bun/@effect+platform@*/node_modules/@effect/platform; do
  if [ -f "$dir/dist/esm/MsgPack.js" ]; then
    MSGPACK_JS="$dir/dist/esm/MsgPack.js"
    break
  fi
done

if [ -z "$MSGPACK_JS" ] || [ ! -f "$MSGPACK_JS" ]; then
  echo "WARN: MsgPack.js not found, skipping patch"
  exit 0
fi

if ! grep -q 'import \* as Msgpackr from "msgpackr"' "$MSGPACK_JS" 2>/dev/null; then
  echo "MsgPack.js already patched or uses different format"
  exit 0
fi

# Cross-platform sed: macOS requires -i '', GNU sed uses -i without arg
# Use a temp file approach instead to avoid sed -i compatibility issues
TMP="${MSGPACK_JS}.patched"
sed 's/import \* as Msgpackr from "msgpackr";/import { encode as msgpackrEncode, decode as msgpackrDecode } from "msgpackr";/' "$MSGPACK_JS" > "$TMP"
sed 's/Msgpackr\.decode(/msgpackrDecode(/g; s/Msgpackr\.encode(/msgpackrEncode(/g' "$TMP" > "${TMP}.2"
mv "${TMP}.2" "$MSGPACK_JS"
rm -f "$TMP"
echo "Patched $MSGPACK_JS"
