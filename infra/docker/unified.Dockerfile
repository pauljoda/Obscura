# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:22-alpine3.20 AS deps

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web-svelte/package.json apps/web-svelte/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ui-svelte/package.json packages/ui-svelte/package.json
COPY packages/app-core/package.json packages/app-core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/media-core/package.json packages/media-core/package.json
COPY packages/stash-import/package.json packages/stash-import/package.json
COPY packages/plugins/package.json packages/plugins/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build all services ──────────────────────────────────
FROM node:22-alpine3.20 AS builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy entire deps output — preserves pnpm's symlink structure
COPY --from=deps /app ./
COPY . .

# RELEASE_STRICT=1 enforces that package.json version matches a versioned
# CHANGELOG heading (set for release builds only). Dev builds only run the
# lightweight structural check.
ARG RELEASE_STRICT=0
RUN if [ "$RELEASE_STRICT" = "1" ]; then \
      pnpm release:check --release; \
    else \
      pnpm release:check; \
    fi && pnpm --filter @obscura/web-svelte build

# ── Stage 3a: Build obscura-phash (Stash-compatible video pHash) ──
FROM golang:1.23-alpine AS phash-builder

RUN apk add --no-cache git

WORKDIR /src/phash
COPY infra/phash/go.mod infra/phash/go.sum ./
RUN go mod download

COPY infra/phash/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/obscura-phash .

# ── Stage 3: Build audiowaveform from source ────────────────────
FROM alpine:3.20 AS audiowaveform-builder

RUN apk add --no-cache \
    cmake make g++ \
    libmad-dev libid3tag-dev libsndfile-dev gd-dev \
    boost-dev boost-program_options boost-regex \
    git

RUN git clone --depth 1 https://github.com/bbc/audiowaveform.git /build/audiowaveform \
  && cd /build/audiowaveform \
  && mkdir build && cd build \
  && cmake -DCMAKE_BUILD_TYPE=Release -DENABLE_TESTS=0 .. \
  && make -j"$(nproc)" \
  && make install

# ── Stage 4: Unified production image ────────────────────────────
FROM node:22-alpine3.20 AS runner

# Install runtime dependencies (including audiowaveform runtime libs)
RUN apk add --no-cache \
    ffmpeg \
    libheif \
    postgresql16 \
    postgresql16-contrib \
    su-exec \
    libmad libid3tag libsndfile libgd \
    boost1.84-filesystem boost1.84-program_options boost1.84-regex \
  && mkdir -p /data/postgres /data/cache /media /run/postgresql \
  && chown -R postgres:postgres /data/postgres /run/postgresql

# Copy audiowaveform binary from builder
COPY --from=audiowaveform-builder /usr/local/bin/audiowaveform /usr/local/bin/audiowaveform

# Copy obscura-phash binary (Stash-compatible video perceptual hash)
COPY --from=phash-builder /out/obscura-phash /usr/local/bin/obscura-phash
ENV OBSCURA_PHASH_BIN=/usr/local/bin/obscura-phash

WORKDIR /app

ENV NODE_ENV=production
# Explicit path so the changelog API route never has to guess
ENV CHANGELOG_PATH=/app/CHANGELOG.md
ENV PUBLIC_APP_URL=http://localhost:8008
ENV PUBLIC_API_URL=/api

# Copy the ENTIRE built workspace — pnpm virtual store and symlinks intact
COPY --from=builder /app ./
COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME ["/data", "/media"]

EXPOSE 8008

ENTRYPOINT ["/entrypoint.sh"]
