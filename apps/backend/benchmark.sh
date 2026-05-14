#!/usr/bin/env bash
#
# V2 Benchmark Runner
# Clears v2 generated assets, triggers a library scan, monitors job completion,
# and captures all [METRICS] timing output.
#
set -euo pipefail

DB="postgresql://obscura:obscura@localhost:5432/obscura"
CACHE_DIR="/tmp/obscura-v2-benchmark-cache"
DATA_DIR="/tmp/obscura-v2-benchmark-data"

mkdir -p "$CACHE_DIR" "$DATA_DIR"

echo "=== V2 BENCHMARK: Preparing ==="

# Clear v2 generated data so we do a full re-generate
docker exec docker-postgres-1 psql -U obscura -d obscura -c "
-- Remove all generated (non-source) entity files
DELETE FROM v2.entity_files WHERE role != 'source';
-- Clear technical metadata so probe re-runs
DELETE FROM v2.entity_technical;
-- Clear fingerprints so fingerprint jobs re-run
DELETE FROM v2.entity_file_fingerprints;
-- Clear subtitle extraction timestamps
UPDATE v2.video_details SET subtitles_extracted_at = NULL;
-- Remove pending/queued v2 jobs
DELETE FROM v2.job_runs WHERE status IN ('queued', 'running');
"

echo "=== V2 BENCHMARK: Starting worker + scan ==="

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"
LOG_FILE="/tmp/v2-benchmark-output.log"

# Build first
dotnet build apps/backend/src/Obscura.Worker/Obscura.Worker.csproj -c Release -q

# Start worker in background, capture output to log file
DATABASE_URL="$DB" \
OBSCURA_CACHE_DIR="$CACHE_DIR" \
OBSCURA_DATA_DIR="$DATA_DIR" \
dotnet run --project apps/backend/src/Obscura.Worker/Obscura.Worker.csproj -c Release --no-build 2>&1 | tee "$LOG_FILE" &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"

sleep 3  # Let worker start up

# Enqueue a library scan
docker exec docker-postgres-1 psql -U obscura -d obscura -c "
INSERT INTO v2.job_runs (id, type, status, payload_json, priority, attempts, max_attempts, progress, available_at, created_at)
VALUES (gen_random_uuid(), 'scan-library', 'queued', '{}', 50, 0, 3, 0, now(), now());
"

echo "=== V2 BENCHMARK: Monitoring ==="
START_TIME=$(date +%s)

IDLE_COUNT=0
while true; do
    sleep 5

    COUNTS=$(docker exec docker-postgres-1 psql -U obscura -d obscura -t -c "
        SELECT
            count(*) FILTER (WHERE status IN ('queued', 'running')) as pending,
            count(*) FILTER (WHERE status = 'completed') as completed,
            count(*) FILTER (WHERE status = 'failed') as failed
        FROM v2.job_runs
        WHERE created_at > now() - interval '30 minutes';
    " 2>/dev/null | tr -d ' ')

    PENDING=$(echo "$COUNTS" | cut -d'|' -f1)
    COMPLETED=$(echo "$COUNTS" | cut -d'|' -f2)
    FAILED=$(echo "$COUNTS" | cut -d'|' -f3)

    echo "[V2-POLL] pending=$PENDING completed=$COMPLETED failed=$FAILED"

    if [ "$PENDING" = "0" ] || [ -z "$PENDING" ]; then
        IDLE_COUNT=$((IDLE_COUNT + 1))
        if [ $IDLE_COUNT -ge 3 ]; then
            END_TIME=$(date +%s)
            TOTAL=$((END_TIME - START_TIME))
            echo ""
            echo "=== V2 BENCHMARK COMPLETE ==="
            echo "Total wall time: ${TOTAL}s"
            echo "Jobs completed: $COMPLETED"
            echo "Jobs failed: $FAILED"
            kill $WORKER_PID 2>/dev/null || true
            exit 0
        fi
    else
        IDLE_COUNT=0
    fi
done
