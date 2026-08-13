#!/usr/bin/env bash
set -euo pipefail

export VERCEL_GIT_COMMIT_SHA=1234567890abcdef1234567890abcdef12345678
export NEXT_PUBLIC_API_URL=https://synk-fueq.onrender.com
export NEXT_PUBLIC_WS_URL=https://synk-fueq.onrender.com

pnpm --filter web build
PORT=3000 pnpm --filter web start >/tmp/synk-polish-web.log 2>&1 &
WEB_PID=$!
trap 'kill "$WEB_PID" 2>/dev/null || true' EXIT

for i in {1..60}; do
  if curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    cat /tmp/synk-polish-web.log || true
    exit 1
  fi
  sleep 1
done

mkdir -p /tmp/pw /tmp/synk-polish
npm install --prefix /tmp/pw playwright@1.54.2
node /tmp/pw/node_modules/playwright/cli.js install chromium firefox
sed -i 's/await context\.setViewportSize/await page.setViewportSize/' scripts/temp-production-polish-regression.cjs
node scripts/temp-production-polish-regression.cjs
