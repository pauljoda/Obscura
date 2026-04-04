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

# Copy all node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/media-core/node_modules ./packages/media-core/node_modules
COPY --from=deps /app/packages/stash-import/node_modules ./packages/stash-import/node_modules

COPY . .

# Build web with API URL pointing to the nginx /api proxy
ENV NEXT_PUBLIC_API_URL=/api
RUN pnpm turbo run build

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
  && mkdir -p /data/postgres /data/redis /data/cache /media \
  && chown -R postgres:postgres /data/postgres

WORKDIR /app

ENV NODE_ENV=production

# ── API + Worker: copy full built app with node_modules ──────────
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
COPY --from=builder /app/apps/api/src/db ./apps/api/src/db
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/packages ./packages

# ── Web: copy Next.js standalone output ──────────────────────────
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# ── nginx config and entrypoint ──────────────────────────────────
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME ["/data", "/media"]

EXPOSE 8008

ENTRYPOINT ["/entrypoint.sh"]
