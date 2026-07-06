#!/bin/sh
set -e

echo "[entrypoint] Checking exercise seed…"
node dist/seed/wger-seed.js

echo "[entrypoint] Starting app…"
exec node dist/main.js
