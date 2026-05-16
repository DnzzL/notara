#!/bin/bash
# Fix @effect/platform MsgPack.js - msgpackr doesn't export 'Msgpackr' as a named export
# This patches both 0.96.0 and 0.96.1 versions

for MSGPACK_FILE in $(find node_modules/.bun -path '*/@effect/platform/dist/esm/MsgPack.js' 2>/dev/null); do
  if grep -q 'export \* as Msgpackr from "msgpackr"' "$MSGPACK_FILE"; then
    echo "Patching $MSGPACK_FILE"
    # Replace the problematic export line with a working alternative
    sed -i.bak 's|// Added for @effect/rpc compatibility with Bun\nexport \* as Msgpackr from "msgpackr";|// Added for @effect/rpc compatibility with Bun\nimport \* as Msgpackr_ from "msgpackr";\nexport { Msgpackr_ as Msgpackr };|' "$MSGPACK_FILE"
    # Remove backup file
    rm -f "${MSGPACK_FILE}.bak"
  fi
done
