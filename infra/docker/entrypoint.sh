#!/bin/sh
set -e

PGDATA="${PGDATA:-/data/postgres}"
CACHE_DIR="/data/cache"

# ── Ensure directories exist ──────────────────────────────────────
mkdir -p "$PGDATA" "$CACHE_DIR" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

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

# ── Apply database migrations ─────────────────────────────────────
# Runs the versioned migration files committed under apps/api/drizzle/ via
# drizzle-orm's migrator. Replaces the previous `drizzle-kit push --force`
# which blindly applied every diff (including destructive drops) at every
# boot — one drifted column and users could lose data on upgrade.
#
# The runner also bridges "legacy push installs" (deployments that originally
# created their schema via drizzle-kit push and therefore have no
# __drizzle_migrations table). For those it applies the small set of
# pre-baseline deltas this release expects, then seeds the migrations table
# so the migrator treats the existing schema as the baseline and only runs
# *new* migrations added after this release.
#
# pg-boss creates its own `pgboss` schema lazily on first API/worker start
# and is independent of drizzle — no action needed here.
echo "[obscura] Applying database migrations..."
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura"
cd /app/apps/api
if ! node_modules/.bin/tsx src/db/migrate.ts; then
  echo "[obscura] ERROR: database migration failed — check logs above. Database is not aligned with this image." >&2
  exit 1
fi

# ── Start API server ──────────────────────────────────────────────
# Run tsx from the api directory so Node resolves it from apps/api/node_modules
echo "[obscura] Starting API server..."
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
PORT=4000 \
HOST=127.0.0.1 \
NODE_ENV=production \
  node_modules/.bin/tsx src/index.ts &

# ── Start worker ──────────────────────────────────────────────────
echo "[obscura] Starting background worker..."
cd /app/apps/worker
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
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
