# syntax=docker/dockerfile:1

# ---------- Frontend build ----------
FROM node:26-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY frontend frontend
RUN npm run build:frontend

# ---------- Backend build ----------
FROM node:26-bookworm-slim AS backend-build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
# Vérifie que le module natif est bien compilé pour ce Node.
RUN npm install && node -e "new (require('better-sqlite3'))(':memory:')"
COPY backend backend
COPY --from=frontend-build /app/frontend/dist frontend/dist
RUN npm run build:backend
RUN npm prune --omit=dev

# ---------- Runtime ----------
FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-build /app/node_modules node_modules
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=backend-build /app/backend/package.json backend/package.json
COPY backend/entrypoint.sh backend/entrypoint.sh
RUN mkdir -p /app/backend/data && chmod +x /app/backend/entrypoint.sh \
    && chown node:node /app/backend /app/backend/data
EXPOSE 3000
# /healthz est interne (bloqué par Caddy). `fetch` de Node : l'image n'a pas besoin de curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
WORKDIR /app/backend
USER node
CMD ["sh", "entrypoint.sh"]
