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
            .Take(100)
            .Select(row => new JobRunSnapshot(
                row.Id,
                row.Type,
                row.Status,
                row.Progress,
                row.Message,
                row.CreatedAt,
                row.StartedAt,
                row.FinishedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<JobRunSnapshot> EnqueueAsync(JobType type, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var row = new JobRunRow
        {
            Id = Guid.NewGuid(),
            Type = type,
            Status = JobRunStatus.Queued,
            PayloadJson = "{}",
            Priority = 0,
            Attempts = 0,
            MaxAttempts = 3,
            Progress = 0,
            AvailableAt = now,
            CreatedAt = now
        };

        _db.JobRuns.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        return ToContract(row);
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

    public async Task<JobRunSnapshot?> ClaimNextAsync(string workerId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);

        var now = DateTimeOffset.UtcNow;
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

        return ToContract(row);
    }

    public async Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken)
    {
        var row = await _db.JobRuns.FindAsync([id], cancellationToken);
        if (row is null)
        {
            return;
        }

        if (row.Status != JobRunStatus.Running)
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
        if (row is null)
        {
            return;
        }

        if (row.Status != JobRunStatus.Running)
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

    private static JobRunSnapshot ToContract(JobRunRow row)
    {
        return new JobRunSnapshot(
            row.Id,
            row.Type,
            row.Status,
            row.Progress,
            row.Message,
            row.CreatedAt,
            row.StartedAt,
            row.FinishedAt);
    }
}
