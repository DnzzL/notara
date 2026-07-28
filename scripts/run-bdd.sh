#!/usr/bin/env bash
set -euo pipefail

# ── BDD test runner ─────────────────────────────────────────────────────────
# Starts the server + app dev servers, waits for them to be ready, runs
# cucumber-js, then kills the servers.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load environment variables from root .env
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

SERVER_PID=""
APP_PID=""

cleanup() {
  local ec=${1:-$?}
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$APP_PID" ] && kill "$APP_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  exit "$ec"
}
trap cleanup EXIT INT TERM

# Start server
echo "→ Starting server…"
cd "$ROOT/packages/server"
bun src/index.ts &
SERVER_PID=$!

# Start app
echo "→ Starting app (Vite)…"
cd "$ROOT/packages/app"
bunx vite --port 5173 &
APP_PID=$!

# Wait for both to be ready
echo "→ Waiting for server on :3000…"
for i in $(seq 1 60); do
  if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "  ✓ Server ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "  ✗ Server not ready after 60s" >&2
    exit 1
  fi
  sleep 1
done

echo "→ Waiting for app on :5173…"
for i in $(seq 1 60); do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo "  ✓ App ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "  ✗ App not ready after 60s" >&2
    exit 1
  fi
  sleep 1
done

echo "→ Running cucumber-js…"
cd "$ROOT"
cucumber-js --config e2e/cucumber.json
