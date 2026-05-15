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

# Note: database migrations run automatically in the shared .NET runtime
# used by the API and worker.

# ── Start worker ──────────────────────────────────────────────────
echo "[obscura] Starting background worker..."
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
OBSCURA_DATA_DIR="/data" \
OBSCURA_SECRET="$OBSCURA_SECRET" \
  dotnet /app/worker/Obscura.Worker.dll &

# ── Start .NET API (foreground — keeps container alive) ───────────
echo "[obscura] Starting .NET API and web frontend on port 8008..."
echo "[obscura] Ready — http://localhost:8008"
exec env \
  DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
  OBSCURA_CACHE_DIR="$CACHE_DIR" \
  OBSCURA_DATA_DIR="/data" \
  OBSCURA_SECRET="$OBSCURA_SECRET" \
  OBSCURA_STATIC_WEB_ROOT="${OBSCURA_STATIC_WEB_ROOT:-/app/wwwroot}" \
  PUBLIC_APP_URL="http://localhost:8008" \
  PUBLIC_API_URL="/api" \
  ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://0.0.0.0:8008}" \
  dotnet /app/api/Obscura.Api.dll
