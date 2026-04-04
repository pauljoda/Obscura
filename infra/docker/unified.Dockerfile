# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/media-core/package.json packages/media-core/package.json
COPY packages/stash-import/package.json packages/stash-import/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build all services ──────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy entire deps output — preserves pnpm's symlink structure
COPY --from=deps /app ./
COPY . .

# Build web with API URL pointing to the nginx /api proxy
ENV NEXT_PUBLIC_API_URL=/api
RUN pnpm turbo run build

# Prepare standalone web in a separate location so it doesn't
# clobber node_modules when copied into the runner
RUN mkdir -p /web-standalone && \
    cp -r apps/web/.next/standalone/apps/web /web-standalone/web && \
    cp -r apps/web/.next/static /web-standalone/web/.next/static && \
    cp -r apps/web/public /web-standalone/web/public

# ── Stage 3: Unified production image ────────────────────────────
FROM node:22-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    postgresql16 \
    postgresql16-contrib \
    redis \
    nginx \
    su-exec \
  && mkdir -p /data/postgres /data/redis /data/cache /media /run/postgresql \
  && chown -R postgres:postgres /data/postgres /run/postgresql

WORKDIR /app

ENV NODE_ENV=production

# Copy the ENTIRE built workspace — pnpm virtual store and symlinks intact
COPY --from=builder /app ./

# Replace apps/web with the optimized standalone build
RUN rm -rf apps/web
COPY --from=builder /web-standalone/web ./apps/web

# nginx config and entrypoint
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME ["/data", "/media"]

EXPOSE 8008

ENTRYPOINT ["/entrypoint.sh"]
