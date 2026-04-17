#!/bin/sh
set -e

PGDATA="${PGDATA:-/data/postgres}"
CACHE_DIR="/data/cache"
SECRET_FILE="/data/.obscura-secret"

# ── Ensure directories exist ──────────────────────────────────────
mkdir -p "$PGDATA" "$CACHE_DIR" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

# ── Resolve or generate OBSCURA_SECRET ────────────────────────────
# Used by the API to encrypt plugin credentials (e.g. TMDB API keys) at rest.
# Prefer an explicit env var; otherwise persist a randomly generated secret in
# the data volume so plugin auth survives container recreation without making
# users provision one by hand.
if [ -z "$OBSCURA_SECRET" ]; then
  if [ -f "$SECRET_FILE" ]; then
    OBSCURA_SECRET="$(cat "$SECRET_FILE")"
  else
    echo "[obscura] Generating new OBSCURA_SECRET for plugin credential encryption..."
    OBSCURA_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n/+=' | head -c 48)"
    umask 077
    printf '%s' "$OBSCURA_SECRET" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
  fi
fi
export OBSCURA_SECRET

# ── Initialize PostgreSQL if fresh ────────────────────────────────
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[obscura] Initializing PostgreSQL database..."
  su-exec postgres initdb -D "$PGDATA" --auth=trust --encoding=UTF8

  # Configure for local-only access
  cat > "$PGDATA/pg_hba.conf" <<CONF
local   all   all                 trust
host    all   all   127.0.0.1/32  trust
host    all   all   ::1/128       trust
CONF

  # Tune for embedded single-user usage. max_connections bumped to 40 so
  # pg-boss (job queue), drizzle (schema push), API, and worker can all hold
  # pool connections without exhausting slots.
  cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
unix_socket_directories = '/run/postgresql'
shared_buffers = 128MB
work_mem = 4MB
max_connections = 40
logging_collector = off
log_destination = 'stderr'
CONF
fi

# ── Start PostgreSQL ──────────────────────────────────────────────
echo "[obscura] Starting PostgreSQL..."
su-exec postgres pg_ctl -D "$PGDATA" -l /data/postgres/log -w -t 30 start

# Create database if it doesn't exist
su-exec postgres psql -h 127.0.0.1 -tc "SELECT 1 FROM pg_database WHERE datname = 'obscura'" | grep -q 1 || \
  su-exec postgres createdb -h 127.0.0.1 obscura

# Note: database migrations run inside the API server on boot — see
# apps/api/src/server.ts. The API also owns the one-time breaking-upgrade
# gate, which serves a consent prompt before any schema changes are
# applied on pre-videos-model installs.
#
# pg-boss creates its own `pgboss` schema lazily on first API/worker start
# and is independent of drizzle — no action needed here.

# ── Start API server ──────────────────────────────────────────────
# Run tsx from the api directory so Node resolves it from apps/api/node_modules
echo "[obscura] Starting API server..."
cd /app/apps/api
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
OBSCURA_DATA_DIR="/data" \
OBSCURA_SECRET="$OBSCURA_SECRET" \
PORT=4000 \
HOST=127.0.0.1 \
NODE_ENV=production \
  node_modules/.bin/tsx src/index.ts &

# ── Start worker ──────────────────────────────────────────────────
echo "[obscura] Starting background worker..."
cd /app/apps/worker
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
OBSCURA_DATA_DIR="/data" \
NODE_ENV=production \
  node_modules/.bin/tsx src/index.ts &

# ── Start Next.js ─────────────────────────────────────────────────
echo "[obscura] Starting web frontend..."
cd /app
HOSTNAME=127.0.0.1 \
PORT=3000 \
NODE_ENV=production \
  node apps/web/server.js &

# ── Start nginx (foreground — keeps container alive) ──────────────
echo "[obscura] Starting nginx reverse proxy on port 8008..."
echo "[obscura] Ready — http://localhost:8008"
exec nginx -g "daemon off;" -c /etc/nginx/nginx.conf
