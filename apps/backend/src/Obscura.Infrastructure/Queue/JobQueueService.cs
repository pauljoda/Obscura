using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Queue;

public sealed class JobQueueService : IJobQueueService
{
    private readonly ObscuraDbContext _db;

    public JobQueueService(ObscuraDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<JobRunSnapshot>> ListAsync(CancellationToken cancellationToken)
    {
        return await _db.JobRuns
            .AsNoTracking()
            .OrderByDescending(row => row.CreatedAt)
            .Take(200)
            .Select(row => ToSnapshot(row))
            .ToListAsync(cancellationToken);
    }

    public async Task<JobRunSnapshot> EnqueueAsync(JobType type, CancellationToken cancellationToken)
    {
        return await EnqueueAsync(new EnqueueJobRequest(type), cancellationToken);
    }

    public async Task<JobRunSnapshot> EnqueueAsync(EnqueueJobRequest request, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var row = new JobRunRow
        {
            Id = Guid.NewGuid(),
            Type = request.Type,
            Status = JobRunStatus.Queued,
            PayloadJson = request.PayloadJson ?? "{}",
            Priority = request.Priority,
            Attempts = 0,
            MaxAttempts = 3,
            Progress = 0,
            TargetEntityKind = request.TargetEntityKind,
            TargetEntityId = request.TargetEntityId,
            TargetLabel = request.TargetLabel,
            AvailableAt = now,
            CreatedAt = now
        };

        _db.JobRuns.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        return ToSnapshot(row);
    }

    public async Task<bool> HasPendingAsync(JobType type, string? targetEntityId, CancellationToken cancellationToken)
    {
        var query = _db.JobRuns.Where(job =>
            job.Type == type &&
            (job.Status == JobRunStatus.Queued || job.Status == JobRunStatus.Running));

        if (targetEntityId is not null)
        {
            query = query.Where(job => job.TargetEntityId == targetEntityId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<int> CancelAsync(JobType? type, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var query = _db.JobRuns
            .Where(job => job.Status == JobRunStatus.Queued || job.Status == JobRunStatus.Running);

        if (type is not null)
        {
            query = query.Where(job => job.Type == type.Value);
        }

        var rows = await query.ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            row.Status = JobRunStatus.Cancelled;
            row.Message = "Cancelled";
            row.LockedAt = null;
            row.LockedBy = null;
            row.FinishedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    public async Task<bool> CancelRunAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await _db.JobRuns.FindAsync([id], cancellationToken);
        if (row is null || (row.Status != JobRunStatus.Queued && row.Status != JobRunStatus.Running))
        {
            return false;
        }

        row.Status = JobRunStatus.Cancelled;
        row.Message = "Cancelled";
        row.LockedAt = null;
        row.LockedBy = null;
        row.FinishedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<int> ClearFailuresAsync(JobType? type, CancellationToken cancellationToken)
    {
        var query = _db.JobRuns.Where(job => job.Status == JobRunStatus.Failed);
        if (type is not null)
        {
            query = query.Where(job => job.Type == type.Value);
        }

        var rows = await query.ToListAsync(cancellationToken);
        foreach (var row in rows)
        {
            row.Status = JobRunStatus.Cancelled;
            row.Message = "Cleared failure";
        }

        await _db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    /// <summary>
    /// Claims the next available job. Uses atomic FOR UPDATE SKIP LOCKED on PostgreSQL
    /// for safe concurrent access, with an EF Core fallback for test providers.
    /// </summary>
    public async Task<JobRunSnapshot?> ClaimNextAsync(string workerId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);

        var now = DateTimeOffset.UtcNow;

        if (_db.Database.IsRelational())
        {
            var claimed = await _db.Database.SqlQueryRaw<Guid>(
                """
                UPDATE v2.job_runs
                SET status = 'running',
                    locked_at = {0},
                    locked_by = {1},
                    started_at = COALESCE(started_at, {0}),
                    attempts = attempts + 1
                WHERE id = (
                    SELECT id FROM v2.job_runs
                    WHERE status = 'queued' AND available_at <= {0}
                    ORDER BY priority DESC, available_at, created_at
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
                """,
                now, workerId).ToListAsync(cancellationToken);

            if (claimed.Count == 0)
            {
                return null;
            }

            var claimedRow = await _db.JobRuns.FindAsync([claimed[0]], cancellationToken);
            return claimedRow is null ? null : ToSnapshot(claimedRow);
        }

        var row = await _db.JobRuns
            .Where(job => job.Status == JobRunStatus.Queued && job.AvailableAt <= now)
            .OrderByDescending(job => job.Priority)
            .ThenBy(job => job.AvailableAt)
            .ThenBy(job => job.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return null;
        }

        row.Status = JobRunStatus.Running;
        row.LockedAt = now;
        row.LockedBy = workerId;
        row.StartedAt ??= now;
        row.Attempts += 1;
        await _db.SaveChangesAsync(cancellationToken);

        return ToSnapshot(row);
    }

    public async Task UpdateProgressAsync(Guid id, int progress, string? message, CancellationToken cancellationToken)
    {
        var row = await _db.JobRuns.FindAsync([id], cancellationToken);
        if (row is null || row.Status != JobRunStatus.Running)
        {
            return;
        }

        row.Progress = Math.Clamp(progress, 0, 100);
        if (message is not null)
        {
            row.Message = message;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken)
    {
        var row = await _db.JobRuns.FindAsync([id], cancellationToken);
        if (row is null || row.Status != JobRunStatus.Running)
        {
            return;
        }

        row.Status = JobRunStatus.Completed;
        row.Progress = 100;
        row.Message = message;
        row.LockedAt = null;
        row.LockedBy = null;
        row.FinishedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task FailAsync(
        Guid id,
        string message,
        TimeSpan retryDelay,
        CancellationToken cancellationToken)
    {
        var row = await _db.JobRuns.FindAsync([id], cancellationToken);
        if (row is null || row.Status != JobRunStatus.Running)
        {
            return;
        }

        var shouldRetry = row.Attempts < row.MaxAttempts;
        row.Status = shouldRetry ? JobRunStatus.Queued : JobRunStatus.Failed;
        row.Message = message;
        row.LockedAt = null;
        row.LockedBy = null;
        row.AvailableAt = shouldRetry ? DateTimeOffset.UtcNow.Add(retryDelay) : row.AvailableAt;
        row.FinishedAt = shouldRetry ? null : DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> PruneHistoryAsync(TimeSpan retention, CancellationToken cancellationToken)
    {
        var cutoff = DateTimeOffset.UtcNow - retention;
        return await _db.JobRuns
            .Where(job =>
                (job.Status == JobRunStatus.Completed || job.Status == JobRunStatus.Cancelled) &&
                job.FinishedAt != null &&
                job.FinishedAt < cutoff)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static JobRunSnapshot ToSnapshot(JobRunRow row)
    {
        return new JobRunSnapshot(
            row.Id,
            row.Type,
            row.Status,
            row.Progress,
            row.Message,
            row.PayloadJson,
            row.TargetEntityKind,
            row.TargetEntityId,
            row.TargetLabel,
            row.CreatedAt,
            row.StartedAt,
            row.FinishedAt);
    }
}
