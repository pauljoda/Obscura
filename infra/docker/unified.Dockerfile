# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:22-alpine3.20 AS deps

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
FROM node:22-alpine3.20 AS builder

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy entire deps output — preserves pnpm's symlink structure
COPY --from=deps /app ./
COPY . .

# Build web with API URL pointing to the nginx /api proxy
ENV NEXT_PUBLIC_API_URL=/api
# RELEASE_STRICT=1 enforces that package.json version matches a versioned
# CHANGELOG heading (set for release builds only). Dev builds only run the
# lightweight structural check.
ARG RELEASE_STRICT=0
RUN if [ "$RELEASE_STRICT" = "1" ]; then \
      pnpm release:check --release; \
    else \
      pnpm release:check; \
    fi && pnpm turbo run build

# Prepare standalone web in a separate location so it doesn't
# clobber node_modules when copied into the runner
RUN mkdir -p /web-standalone && \
    cp -r apps/web/.next/standalone/apps/web /web-standalone/web && \
    cp -r apps/web/.next/static /web-standalone/web/.next/static && \
    cp -r apps/web/public /web-standalone/web/public && \
    cp CHANGELOG.md /web-standalone/web/CHANGELOG.md

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
    nginx \
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
ENV INTERNAL_API_URL=http://localhost:4000
# Explicit path so the changelog API route never has to guess
ENV CHANGELOG_PATH=/app/CHANGELOG.md

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
