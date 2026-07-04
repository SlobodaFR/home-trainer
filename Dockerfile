# syntax=docker/dockerfile:1

# ---------- Frontend build ----------
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY frontend frontend
RUN npm run build:frontend

# ---------- Backend build ----------
FROM node:20-bookworm-slim AS backend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY backend backend
COPY --from=frontend-build /app/frontend/dist frontend/dist
RUN npm run build:backend
RUN npm prune --omit=dev

# ---------- Runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-build /app/node_modules node_modules
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=backend-build /app/backend/package.json backend/package.json
EXPOSE 3000
WORKDIR /app/backend
CMD ["node", "dist/main.js"]
