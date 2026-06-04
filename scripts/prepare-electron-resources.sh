#!/usr/bin/env bash
set -euo pipefail

ELECTRON_DIR="$(cd "$(dirname "$0")/../packages/electron" && pwd)"
RESOURCES_DIR="$ELECTRON_DIR/resources"

rm -rf "$RESOURCES_DIR"
mkdir -p "$RESOURCES_DIR"

BUN_PATH="$(which bun 2>/dev/null || true)"

if [ -z "$BUN_PATH" ]; then
  echo "Error: bun not found in PATH. Cannot build Electron app without bun." >&2
  exit 1
fi

cp "$BUN_PATH" "$RESOURCES_DIR/bun"
chmod +x "$RESOURCES_DIR/bun"
echo "Copied bun from $BUN_PATH to $RESOURCES_DIR/bun"
