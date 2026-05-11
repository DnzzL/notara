#!/usr/bin/env bash
# Fix for @effect/platform@0.96.1 + msgpackr@1.11.x on Bun 1.3.x
# The "import * as Msgpackr" pattern doesn't work with msgpackr's re-exported
# ESM modules in Bun. We patch MsgPack.js to use named imports instead.

set -euo pipefail

# Find the @effect/platform package in node_modules
PLATFORM_DIR=""
for dir in node_modules/@effect/platform \
           node_modules/.bun/@effect+platform@*/node_modules/@effect/platform; do
  if [ -f "$dir/dist/esm/MsgPack.js" ]; then
    PLATFORM_DIR="$dir"
    break
  fi
done

if [ -z "$PLATFORM_DIR" ]; then
  echo "WARN: @effect/platform not found, skipping msgpackr patch"
  exit 0
fi

MSGPACK_JS="$PLATFORM_DIR/dist/esm/MsgPack.js"

# Replace "import * as Msgpackr from 'msgpackr'" with named imports
# that work correctly with Bun's ESM resolver for msgpackr 1.11.x
if grep -q 'import \* as Msgpackr from "msgpackr"' "$MSGPACK_JS"; then
  sed -i 's/import \* as Msgpackr from "msgpackr";/import { encode as msgpackrEncode, decode as msgpackrDecode } from "msgpackr";/' "$MSGPACK_JS"
  sed -i 's/Msgpackr\.decode(/msgpackrDecode(/g' "$MSGPACK_JS"
  sed -i 's/Msgpackr\.encode(/msgpackrEncode(/g' "$MSGPACK_JS"
  echo "Patched $MSGPACK_JS for Bun/msgpackr compatibility"
else
  echo "MsgPack.js already patched or uses different format"
fi
