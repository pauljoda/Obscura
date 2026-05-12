namespace Obscura.Infrastructure.Queue;

public static class JobQueueSql
{
    public const string ClaimNext = """
        WITH next_job AS (
            SELECT id
            FROM v2.job_runs
            WHERE status = 'queued'
              AND available_at <= now()
            ORDER BY priority DESC, available_at, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE v2.job_runs job
        SET
            status = 'running',
            locked_at = now(),
            locked_by = @worker_id,
            started_at = COALESCE(started_at, now()),
            attempts = attempts + 1
        FROM next_job
        WHERE job.id = next_job.id
        RETURNING job.*;
        """;

    public const string MarkCompleted = """
        UPDATE v2.job_runs
        SET
            status = 'completed',
            progress = 100,
            message = @message,
            locked_at = NULL,
            locked_by = NULL,
            finished_at = now()
        WHERE id = @id;
        """;

    public const string MarkFailed = """
        UPDATE v2.job_runs
        SET
            status = CASE
                WHEN attempts < max_attempts THEN 'queued'
                ELSE 'failed'
            END,
            message = @message,
            locked_at = NULL,
            locked_by = NULL,
            available_at = CASE
                WHEN attempts < max_attempts THEN now() + (@retry_delay_seconds || ' seconds')::interval
                ELSE available_at
            END,
            finished_at = CASE
                WHEN attempts < max_attempts THEN NULL
                ELSE now()
            END
        WHERE id = @id;
        """;
}
