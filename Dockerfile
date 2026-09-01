# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first: this layer is cached until a dependency actually changes.
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm --prefix backend ci && npm --prefix frontend ci

COPY . .

# Builds the SPA, copies it under backend/public/client, then compiles the API.
RUN npm run build

# Drop dev dependencies from what ships.
RUN npm --prefix backend prune --omit=dev

# ---------- run ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Don't run as root.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/backend/package.json ./package.json
COPY --from=build --chown=app:app /app/backend/node_modules ./node_modules
COPY --from=build --chown=app:app /app/backend/dist ./dist
COPY --from=build --chown=app:app /app/backend/public ./public

USER app

# Render and Fly inject PORT; this is only the local default.
ENV PORT=8000
EXPOSE 8000

# The app answers this once Mongo is connected, so it doubles as a readiness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
