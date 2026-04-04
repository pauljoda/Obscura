# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/media-core/package.json packages/media-core/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/media-core/node_modules ./packages/media-core/node_modules

COPY . .

RUN pnpm turbo run build --filter=@obscura/worker

# ── Stage 3: Production runner ────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache ffmpeg

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

RUN mkdir -p /data/cache

VOLUME ["/data/cache", "/media"]

CMD ["node", "apps/worker/dist/index.js"]
