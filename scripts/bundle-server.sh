#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_DIR="$ROOT_DIR/packages/electron"
RESOURCES_DIR="$ELECTRON_DIR/resources"
SERVER_SRC="$ROOT_DIR/packages/server/src/index.ts"

# Output to resources/dist/ so that path.join(__dirname, "../migrations")
# resolves to resources/migrations/ (matching the pre-bundle layout).
mkdir -p "$RESOURCES_DIR/dist"

echo "Bundling server for Electron production..."
bun build --target=bun \
  --external=kysely --external='@better-auth/kysely-adapter' --external='better-auth' \
  --outfile="$RESOURCES_DIR/dist/index.js" "$SERVER_SRC"
echo "Server bundled to $RESOURCES_DIR/dist/index.js"

# Copy externalized packages so they're resolvable at runtime
for pkg in kysely better-auth '@better-auth/kysely-adapter'; do
  src=$(node -e "console.log(require.resolve('$pkg'))" 2>/dev/null || true)
  if [ -n "$src" ]; then
    dir="$(dirname "$src")"
    # Walk up to find the package root (has package.json)
    while [ ! -f "$dir/package.json" ]; do dir="$(dirname "$dir")"; done
    dest="$RESOURCES_DIR/node_modules/$pkg"
    mkdir -p "$(dirname "$dest")"
    cp -r "$dir" "$dest"
    echo "  copied $pkg → $dest"
  fi
done
