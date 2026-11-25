#!/bin/sh
set -e

# Le seed Wger appelle une API publique : il ne doit JAMAIS empêcher l'app de démarrer.
# Base déjà complète : il sort tout de suite. Sinon (réseau, API lente) il avertit et l'app démarre
# quand même ; le seed est tout-ou-rien et sera retenté au prochain démarrage.
# `timeout` (coreutils, présent dans node:*-bookworm-slim) borne le seed entier, y compris l'ouverture
# de la base ; sans lui (hors image), le seed tourne tel quel, déjà borné par ses propres délais.
SEED_TIMEOUT_SECONDS="${SEED_TIMEOUT_SECONDS:-90}"
echo "[entrypoint] Checking exercise seed…"
if command -v timeout >/dev/null 2>&1; then
  seed_ok=0
  timeout -k 5 "$SEED_TIMEOUT_SECONDS" node dist/seed/wger-seed.js || seed_ok=$?
else
  seed_ok=0
  node dist/seed/wger-seed.js || seed_ok=$?
fi
if [ "$seed_ok" -ne 0 ]; then
  echo "[entrypoint] WARNING: exercise seed failed or timed out (exit $seed_ok; wger.de unreachable or slow?) — starting the app anyway; it will be retried at next boot." >&2
fi

echo "[entrypoint] Starting app…"
exec node dist/main.js
