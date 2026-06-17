#!/usr/bin/env bash
# Headless-Chrome end-to-end smokes for the Sudoku Solver.
# Builds the app, serves the production build, drives Chrome via the DevTools
# Protocol (no extra npm deps), runs the smoke suites, and cleans up.
#
# Usage: bash scripts/smoke/run.sh            # runs smoke2 + smoke3 + smoke4
#        bash scripts/smoke/run.sh smoke4     # run a single suite
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SMOKE_DIR="$ROOT/scripts/smoke"
PORT="${PORT:-4188}"
CDP_PORT="${CDP_PORT:-9230}"
PROFILE="$(mktemp -d)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SUITES=("${@:-smoke2 smoke3 smoke4}")

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME (override with CHROME=/path/to/chrome)"; exit 1
fi

cd "$ROOT"
echo "==> building"
npm run build >/dev/null

echo "==> starting preview on :$PORT"
npm run preview -- --port "$PORT" >/tmp/sudoku-smoke-preview.log 2>&1 &
PREVIEW_PID=$!

echo "==> starting headless Chrome on :$CDP_PORT"
"$CHROME" --headless=new --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$PROFILE" --window-size=1280,900 \
  --no-first-run --no-default-browser-check --disable-gpu about:blank \
  >/tmp/sudoku-smoke-chrome.log 2>&1 &
CHROME_PID=$!

cleanup() { kill "$CHROME_PID" "$PREVIEW_PID" 2>/dev/null || true; rm -rf "$PROFILE"; }
trap cleanup EXIT
sleep 3

fail=0
for suite in $SUITES; do
  echo "==> running $suite"
  if ! node "$SMOKE_DIR/$suite.mjs" "http://localhost:$PORT/" "$CDP_PORT"; then
    fail=1
  fi
done

exit "$fail"
