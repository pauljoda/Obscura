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
