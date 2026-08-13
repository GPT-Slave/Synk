#!/usr/bin/env bash
set -euo pipefail

export VERCEL_GIT_COMMIT_SHA=2a0b368ca951be09780f6bae4ee9b6a8d22cafd4
export NEXT_PUBLIC_API_URL=http://localhost:4000
export NEXT_PUBLIC_WS_URL=ws://localhost:4000

pnpm --filter web build
PORT=3000 pnpm --filter web start >/tmp/synk-web.log 2>&1 &
WEB_PID=$!
trap 'kill "$WEB_PID" 2>/dev/null || true' EXIT

for i in {1..60}; do
  if curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    cat /tmp/synk-web.log || true
    exit 1
  fi
  sleep 1
done

mkdir -p /tmp/pw /tmp/prod-i18n
npm install --prefix /tmp/pw playwright@1.54.2
node /tmp/pw/node_modules/playwright/cli.js install chromium
node scripts/temp-production-i18n-regression.cjs
