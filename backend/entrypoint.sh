#!/bin/sh
set -e

# Le seed Wger appelle une API publique : il ne doit JAMAIS empêcher l'app de démarrer.
# Si la base est déjà peuplée il sort tout de suite ; sinon (réseau, API lente) il avertit et
# l'app démarre quand même ; le seed est tout-ou-tout et sera retenté au prochain démarrage.
echo "[entrypoint] Checking exercise seed…"
if ! node dist/seed/wger-seed.js; then
  echo "[entrypoint] WARNING: exercise seed failed (wger.de unreachable or slow?) — starting the app anyway; it will be retried at next boot." >&2
fi

echo "[entrypoint] Starting app…"
exec node dist/main.js
