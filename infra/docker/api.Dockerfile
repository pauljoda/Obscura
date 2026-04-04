# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/media-core/package.json packages/media-core/package.json
COPY packages/stash-import/package.json packages/stash-import/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

COPY . .

RUN pnpm turbo run build --filter=@obscura/api

# ── Stage 3: Production runner ────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache ffmpeg

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app ./

RUN mkdir -p /data/cache

VOLUME ["/data/cache"]

EXPOSE 4000

CMD ["node", "--import", "tsx/esm", "apps/api/src/index.ts"]
