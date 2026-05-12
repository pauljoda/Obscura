using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Jobs;
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

    public async Task<IReadOnlyList<JobRunDto>> ListAsync(CancellationToken cancellationToken)
    {
        return await _db.JobRuns
            .AsNoTracking()
            .OrderByDescending(row => row.CreatedAt)
            .Take(100)
            .Select(row => new JobRunDto(
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

    public async Task<JobRunDto> EnqueueAsync(string type, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(type);

        var now = DateTimeOffset.UtcNow;
        var row = new JobRunRow
        {
            Id = Guid.NewGuid(),
            Type = type,
            Status = "queued",
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

        return ToDto(row);
    }

    public async Task<JobRunDto?> ClaimNextAsync(string workerId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);

        var now = DateTimeOffset.UtcNow;
        var row = await _db.JobRuns
            .Where(job => job.Status == "queued" && job.AvailableAt <= now)
            .OrderByDescending(job => job.Priority)
            .ThenBy(job => job.AvailableAt)
            .ThenBy(job => job.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return null;
        }

        row.Status = "running";
        row.LockedAt = now;
        row.LockedBy = workerId;
        row.StartedAt ??= now;
        row.Attempts += 1;
        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(row);
    }

    public async Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken)
    {
        var row = await _db.JobRuns.FindAsync([id], cancellationToken);
        if (row is null)
        {
            return;
        }

        row.Status = "completed";
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
        row.Status = shouldRetry ? "queued" : "failed";
        row.Message = message;
        row.LockedAt = null;
        row.LockedBy = null;
        row.AvailableAt = shouldRetry ? DateTimeOffset.UtcNow.Add(retryDelay) : row.AvailableAt;
        row.FinishedAt = shouldRetry ? null : DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static JobRunDto ToDto(JobRunRow row)
    {
        return new JobRunDto(
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
