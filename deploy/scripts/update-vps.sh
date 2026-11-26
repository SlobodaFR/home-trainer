#!/bin/sh
set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/trainer}"
IMAGE="${IMAGE:-ghcr.io/slobodafr/home-trainer}"

cd "$DEPLOY_DIR/deploy"

export IMAGE
export IMAGE_TAG

# Convention harnais image-retention : fait de la place AVANT le pull (garde keep-1 images par dépôt).
sh "$DEPLOY_DIR/deploy/scripts/prune-service-images.sh" --phase pre \
  --service trainer --image "$IMAGE" \
  --tag "$IMAGE_TAG" --project trainer
docker compose pull
# Convention harnais docker-nonroot-volume : le volume cree par l'ancienne image (root) est rendu a l'uid 1000 de l'image
# non root. Le service est arrete puis le volume chown, dans le deploiement (sous le verrou d'hote de deploy-vps.yml).
# ORDRE (non verifie par l'audit) : la sauvegarde pre-deploy-backup tourne AVANT ce script ; ne jamais deplacer ce chown
# avant elle, ni apres compose-up-healthy.sh. `set -e` : pas de `||`.
sh "$DEPLOY_DIR/deploy/scripts/fix-volume-owner.sh" --service trainer \
  --project trainer --volume trainer-data --stop trainer
# Convention harnais deploy-wait-healthy : `docker compose up -d --wait` (repli : boucle docker inspect) ; un conteneur
# qui n'est pas sain après 180 s fait échouer le déploiement (logs, sauvegarde et restauration affichées), sans retour arrière automatique.
sh "$DEPLOY_DIR/deploy/scripts/compose-up-healthy.sh" --service trainer \
  --restore-args "--project trainer --volume trainer-data --mount /app/backend/data --db-path ${DATABASE_PATH:-data/trainer.sqlite}" \
  -- --remove-orphans
# Convention harnais image-retention : après un déploiement sain uniquement (set -e), garde 2 images par dépôt.
sh "$DEPLOY_DIR/deploy/scripts/prune-service-images.sh" --phase post \
  --service trainer --image "$IMAGE" \
  --tag "$IMAGE_TAG" --project trainer

if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
fi

sudo mkdir -p /etc/caddy/sites
sudo cp "$DEPLOY_DIR/deploy/Caddyfile" /etc/caddy/sites/trainer.Caddyfile

# Remove any legacy top-level trainer.sloboda.fr block from the main Caddyfile.
if [ -f /etc/caddy/Caddyfile ] && grep -q '^trainer\.sloboda\.fr[[:space:]]*{' /etc/caddy/Caddyfile; then
  sudo awk '
    /^trainer\.sloboda\.fr[[:space:]]*\{/ { skip=1; next }
    skip && /^}/ { skip=0; next }
    skip { next }
    { print }
  ' /etc/caddy/Caddyfile | sudo tee /etc/caddy/Caddyfile.tmp >/dev/null
  sudo mv /etc/caddy/Caddyfile.tmp /etc/caddy/Caddyfile
fi

if ! grep -q '^import sites/\*$' /etc/caddy/Caddyfile 2>/dev/null; then
  echo 'import sites/*' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi

sudo caddy validate --config /etc/caddy/Caddyfile

sudo systemctl reload caddy
