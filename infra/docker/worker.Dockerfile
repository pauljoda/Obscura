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
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

COPY . .

RUN pnpm turbo run build --filter=@obscura/worker

# ── Stage 2b: Build obscura-phash (Stash-compatible video pHash) ──
FROM golang:1.23-alpine AS phash-builder

RUN apk add --no-cache git

WORKDIR /src/phash
COPY infra/phash/go.mod infra/phash/go.sum ./
RUN go mod download

COPY infra/phash/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/obscura-phash .

# ── Stage 3: Production runner ────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache ffmpeg

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./
COPY --from=phash-builder /out/obscura-phash /usr/local/bin/obscura-phash
ENV OBSCURA_PHASH_BIN=/usr/local/bin/obscura-phash

RUN mkdir -p /data/cache

VOLUME ["/data/cache", "/media"]

CMD ["./apps/worker/node_modules/.bin/tsx", "apps/worker/src/index.ts"]
