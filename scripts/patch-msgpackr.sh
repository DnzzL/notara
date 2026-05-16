#!/usr/bin/env bash
# Postinstall patch: fix @effect/platform MsgPack.js missing Msgpackr export
# The msgpackr namespace is imported but never exported, causing
# "Export named 'Msgpackr' not found" errors in @effect/rpc

for MSGPACK_FILE in $(find node_modules/.bun -path '*/@effect/platform/dist/esm/MsgPack.js' -type f 2>/dev/null); do
  if ! grep -q 'export { Msgpackr }' "$MSGPACK_FILE" 2>/dev/null; then
    echo "Patching $MSGPACK_FILE"
    echo '// Re-export msgpackr namespace for @effect/rpc compatibility
export { Msgpackr };' >> "$MSGPACK_FILE"
  fi
done
