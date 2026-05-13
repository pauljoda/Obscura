using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs;
using Obscura.Contracts.Jobs;
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

    public async Task<IReadOnlyList<JobRun>> ListAsync(CancellationToken cancellationToken)
    {
        return await _db.JobRuns
            .AsNoTracking()
            .OrderByDescending(row => row.CreatedAt)
            .Take(100)
            .Select(row => new JobRun(
                row.Id,
                row.Type.ToCode(),
                row.Status.ToCode(),
                row.Progress,
                row.Message,
                row.CreatedAt,
                row.StartedAt,
                row.FinishedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<JobRun> EnqueueAsync(JobType type, CancellationToken cancellationToken)
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

    public async Task<JobRun?> ClaimNextAsync(string workerId, CancellationToken cancellationToken)
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

        var shouldRetry = row.Attempts < row.MaxAttempts;
        row.Status = shouldRetry ? JobRunStatus.Queued : JobRunStatus.Failed;
        row.Message = message;
        row.LockedAt = null;
        row.LockedBy = null;
        row.AvailableAt = shouldRetry ? DateTimeOffset.UtcNow.Add(retryDelay) : row.AvailableAt;
        row.FinishedAt = shouldRetry ? null : DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static JobRun ToContract(JobRunRow row)
    {
        return new JobRun(
            row.Id,
            row.Type.ToCode(),
            row.Status.ToCode(),
            row.Progress,
            row.Message,
            row.CreatedAt,
            row.StartedAt,
            row.FinishedAt);
    }
}
