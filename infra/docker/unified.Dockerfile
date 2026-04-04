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
# Use a single recursive copy — pnpm hoists most deps to root node_modules
# and only creates per-package node_modules when needed (some packages have none)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

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

# ── API + Worker: copy source, node_modules, and packages ────────
# API and worker run via tsx (TypeScript runtime) — no dist/ needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/worker ./apps/worker
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
