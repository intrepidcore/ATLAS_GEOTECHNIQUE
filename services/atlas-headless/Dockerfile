# ── Dockerfile Phase 1 : Puppeteer (Chromium headless) ────────────────────────
# Sprint 2 — atlas-headless worker
# Cible : ~500ms-3s/carte, fidélité visuelle parfaite

FROM node:20-alpine AS base

# Chromium + dependances pour Puppeteer headless
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    && rm -rf /var/cache/apk/*

# Puppeteer utilise le Chromium systeme, pas son propre binaire
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# ── Build ──────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

# Copier uniquement les modules de production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copier le build
COPY --from=builder /build/dist ./dist/

# Utilisateur non-root pour la securite (Chromium fonctionne avec --no-sandbox)
RUN addgroup -S headless && adduser -S headless -G headless
USER headless

# Volume pour les exports
VOLUME ["/data/exports/hq"]

ENV EXPORTS_DIR=/data/exports/hq \
    ENGINE=puppeteer \
    POLL_INTERVAL_MS=2000 \
    WORKER_POOL_SIZE=3 \
    MAX_RETRIES=3 \
    JOB_TIMEOUT_MS=120000 \
    METRICS_ENABLED=true \
    METRICS_PORT=9091

EXPOSE 9091

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s CMD \
    wget -qO- http://localhost:9091/metrics | grep -q atlas_headless || exit 1

CMD ["node", "dist/index.js"]
