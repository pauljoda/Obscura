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
# Run redis-server in the foreground, backgrounded by the shell. Daemonizing
# with `daemonize yes` caused silent startup failures on Alpine: once the
# parent forks the child closes stdin/stdout/stderr, so any bind/pidfile/dir
# error disappeared and BullMQ saw ECONNREFUSED on 127.0.0.1:6379. Keeping the
# process attached gives us a real exit code and captured logs to diagnose.
echo "[obscura] Starting Redis..."
REDIS_CONF="/run/obscura-redis.conf"
REDIS_LOG="/data/redis/redis.log"
cat > "$REDIS_CONF" <<EOF
bind 127.0.0.1
port 6379
dir $REDIS_DIR
daemonize no
pidfile /run/obscura-redis.pid
logfile $REDIS_LOG
loglevel notice
protected-mode no
EOF
REDIS_RDB_QUARANTINED=0
start_redis() {
  : > "$REDIS_LOG"
  redis-server "$REDIS_CONF" &
  REDIS_PID=$!
}

# A dump.rdb written by a newer Redis (e.g. 8.x uses RDB v12) is fatal for the
# Alpine-packaged Redis 7.2.x bundled in this image: "Can't handle RDB format
# version". Move any incompatible snapshot aside exactly once and let Redis
# start fresh. Queue state is transient (BullMQ jobs can be re-triggered).
quarantine_rdb_if_incompatible() {
  if grep -q "Can't handle RDB format version" "$REDIS_LOG" 2>/dev/null \
     && [ -f "$REDIS_DIR/dump.rdb" ] \
     && [ "$REDIS_RDB_QUARANTINED" -eq 0 ]; then
    QUAR="$REDIS_DIR/dump.rdb.incompatible-$(date +%Y%m%d-%H%M%S)"
    echo "[obscura] Redis cannot load $REDIS_DIR/dump.rdb (newer RDB format)." >&2
    echo "[obscura] Moving it aside to $QUAR and starting fresh. Queue state will be lost." >&2
    mv "$REDIS_DIR/dump.rdb" "$QUAR"
    REDIS_RDB_QUARANTINED=1
    return 0
  fi
  return 1
}

start_redis
echo "[obscura] Waiting for Redis to accept connections (pid=$REDIS_PID)..."
i=0
while :; do
  if ! kill -0 "$REDIS_PID" 2>/dev/null; then
    if quarantine_rdb_if_incompatible; then
      start_redis
      echo "[obscura] Restarted Redis after quarantining incompatible dump (pid=$REDIS_PID)."
      i=0
      continue
    fi
    echo "[obscura] ERROR: redis-server exited before becoming ready. Last log lines:" >&2
    tail -n 50 "$REDIS_LOG" 2>/dev/null || true
    exit 1
  fi
  if redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
    echo "[obscura] Redis is ready."
    break
  fi
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[obscura] ERROR: Redis did not become ready on 127.0.0.1:6379 within 30s. Last log lines:" >&2
    tail -n 50 "$REDIS_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 0.5
done

# ── Push database schema ──────────────────────────────────────────
# Must succeed: an outdated schema causes widespread API 500s (queries reference
# missing tables). Do not swallow errors — the old `|| true` hid failed pushes.
# --force avoids interactive prompts in non-TTY Docker; back up /data before major upgrades.
# Invoke drizzle-kit with plain Node — the production image has no pnpm (build-only tool).
echo "[obscura] Applying database schema..."
export CI=true
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura"
cd /app/apps/api
if ! node node_modules/drizzle-kit/bin.cjs push --force; then
  echo "[obscura] ERROR: drizzle-kit push failed — check logs above. Database is not aligned with this image." >&2
  exit 1
fi

# ── Start API server ──────────────────────────────────────────────
# Run tsx from the api directory so Node resolves it from apps/api/node_modules
echo "[obscura] Starting API server..."
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
REDIS_URL="redis://127.0.0.1:6379" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
PORT=4000 \
HOST=127.0.0.1 \
NODE_ENV=production \
  node_modules/.bin/tsx src/index.ts &

# ── Start worker ──────────────────────────────────────────────────
echo "[obscura] Starting background worker..."
cd /app/apps/worker
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/obscura" \
REDIS_URL="redis://127.0.0.1:6379" \
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
