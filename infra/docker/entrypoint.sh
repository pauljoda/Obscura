#!/bin/sh
set -e

PGDATA="${PGDATA:-/data/postgres}"
REDIS_DIR="/data/redis"
CACHE_DIR="/data/cache"

# ── Ensure directories exist ──────────────────────────────────────
mkdir -p "$PGDATA" "$REDIS_DIR" "$CACHE_DIR" /run/postgresql
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

  # Tune for embedded single-user usage
  cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
unix_socket_directories = '/run/postgresql'
shared_buffers = 128MB
work_mem = 4MB
max_connections = 20
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

# ── Start Redis ───────────────────────────────────────────────────
echo "[obscura] Starting Redis..."
redis-server --daemonize yes --dir "$REDIS_DIR" --loglevel warning

# ── Push database schema ──────────────────────────────────────────
echo "[obscura] Applying database schema..."
cd /app/apps/api
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
  node ../../node_modules/drizzle-kit/bin.cjs push 2>&1 || true
cd /app

# ── Start API server ──────────────────────────────────────────────
echo "[obscura] Starting API server..."
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
REDIS_URL="redis://127.0.0.1:6379" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
PORT=4000 \
HOST=127.0.0.1 \
NODE_ENV=production \
  node --import tsx/esm apps/api/src/index.ts &

# ── Start worker ──────────────────────────────────────────────────
echo "[obscura] Starting background worker..."
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
REDIS_URL="redis://127.0.0.1:6379" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
NODE_ENV=production \
  node --import tsx/esm apps/worker/src/index.ts &

# ── Start Next.js ─────────────────────────────────────────────────
echo "[obscura] Starting web frontend..."
HOSTNAME=127.0.0.1 \
PORT=3000 \
NODE_ENV=production \
  node apps/web/server.js &

# ── Start nginx (foreground — keeps container alive) ──────────────
echo "[obscura] Starting nginx reverse proxy on port 8008..."
echo "[obscura] Ready — http://localhost:8008"
exec nginx -g "daemon off;" -c /etc/nginx/nginx.conf
