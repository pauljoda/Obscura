using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;
using Obscura.Infrastructure.Queue;

namespace Obscura.Infrastructure.Tests;

public sealed class JobQueueServiceTests {
    [Fact]
    public async Task EnqueueCreatesQueuedJobAndListReturnsNewestFirst() {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var first = await service.EnqueueAsync(JobType.ScanLibrary, CancellationToken.None);
        var second = await service.EnqueueAsync(JobType.ProbeVideo, CancellationToken.None);
        var jobs = await service.ListAsync(CancellationToken.None);

        Assert.Equal(JobRunStatus.Queued, first.Status);
        Assert.Equal(JobType.ProbeVideo, second.Type);
        Assert.Equal(2, jobs.Count);
        Assert.Equal(second.Id, jobs[0].Id);
        Assert.Equal(first.Id, jobs[1].Id);
    }

    [Fact]
    public async Task ListKeepsActiveAndFailedRunsVisibleWhenBacklogExceedsRecentLimit() {
        await using var db = CreateContext();
        var service = new JobQueueService(db);
        var now = DateTimeOffset.UtcNow;
        var running = NewJobRun(JobType.GeneratePreview, JobRunStatus.Running, now.AddHours(-3));
        var failed = NewJobRun(JobType.FingerprintVideo, JobRunStatus.Failed, now.AddHours(-2));
        db.JobRuns.AddRange(running, failed);

        for (var i = 0; i < 210; i++) {
            db.JobRuns.Add(NewJobRun(
                JobType.ProbeVideo,
                JobRunStatus.Queued,
                now.AddMinutes(i),
                targetEntityId: i.ToString()));
        }

        await db.SaveChangesAsync();

        var jobs = await service.ListAsync(CancellationToken.None);

        Assert.Contains(jobs, job => job.Id == running.Id);
        Assert.Contains(jobs, job => job.Id == failed.Id);
        Assert.True(jobs.Count <= 200);
    }

    [Fact]
    public async Task ClaimCompleteAndFailAdvanceJobLifecycle() {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var created = await service.EnqueueAsync(JobType.Noop, CancellationToken.None);
        var claimed = await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.CompleteAsync(created.Id, "done", CancellationToken.None);
        var completed = await db.JobRuns.FindAsync(created.Id);

        Assert.NotNull(claimed);
        Assert.Equal(created.Id, claimed.Id);
        Assert.Equal(JobRunStatus.Running, claimed.Status);
        Assert.NotNull(completed);
        Assert.Equal(JobRunStatus.Completed, completed.Status);
        Assert.Equal(100, completed.Progress);
        Assert.Equal("done", completed.Message);
    }

    [Fact]
    public async Task FailedClaimRetriesUntilMaxAttempts() {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var created = await service.EnqueueAsync(JobType.ImportMetadata, CancellationToken.None);
        await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.FailAsync(created.Id, "missing handler", TimeSpan.Zero, CancellationToken.None);
        await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.FailAsync(created.Id, "missing handler", TimeSpan.Zero, CancellationToken.None);
        await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.FailAsync(created.Id, "missing handler", TimeSpan.Zero, CancellationToken.None);
        var failed = await db.JobRuns.FindAsync(created.Id);

        Assert.NotNull(failed);
        Assert.Equal(JobRunStatus.Failed, failed.Status);
        Assert.Equal(3, failed.Attempts);
        Assert.NotNull(failed.FinishedAt);
    }

    [Fact]
    public async Task CancelAndClearFailuresMoveRunsOutOfActiveBuckets() {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var queued = await service.EnqueueAsync(JobType.ScanLibrary, CancellationToken.None);
        var pending = await service.EnqueueAsync(JobType.ProbeVideo, CancellationToken.None);
        var running = await service.ClaimNextAsync("worker-1", CancellationToken.None);

        var cancelled = await service.CancelAsync(null, CancellationToken.None);
        Assert.NotNull(running);
        await service.CompleteAsync(running.Id, "should not overwrite cancellation", CancellationToken.None);
        var cancelledQueued = await db.JobRuns.FindAsync(queued.Id);
        var cancelledPending = await db.JobRuns.FindAsync(pending.Id);

        Assert.Equal(2, cancelled);
        Assert.NotNull(cancelledQueued);
        Assert.NotNull(cancelledPending);
        Assert.Equal(JobRunStatus.Cancelled, cancelledQueued.Status);
        Assert.Equal(JobRunStatus.Cancelled, cancelledPending.Status);

        var failed = await service.EnqueueAsync(JobType.ImportMetadata, CancellationToken.None);
        await service.ClaimNextAsync("worker-2", CancellationToken.None);
        await service.FailAsync(failed.Id, "permanent", TimeSpan.Zero, CancellationToken.None);
        await service.ClaimNextAsync("worker-2", CancellationToken.None);
        await service.FailAsync(failed.Id, "permanent", TimeSpan.Zero, CancellationToken.None);
        await service.ClaimNextAsync("worker-2", CancellationToken.None);
        await service.FailAsync(failed.Id, "permanent", TimeSpan.Zero, CancellationToken.None);

        var cleared = await service.ClearFailuresAsync(JobType.ImportMetadata, CancellationToken.None);
        var clearedFailed = await db.JobRuns.FindAsync(failed.Id);

        Assert.Equal(1, cleared);
        Assert.NotNull(clearedFailed);
        Assert.Equal(JobRunStatus.Cancelled, clearedFailed.Status);
    }

    private static ObscuraDbContext CreateContext() {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"job-queue-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static JobRunRow NewJobRun(
        JobType type,
        JobRunStatus status,
        DateTimeOffset createdAt,
        string? targetEntityId = null) =>
        new() {
            Id = Guid.NewGuid(),
            Type = type,
            Status = status,
            PayloadJson = "{}",
            Attempts = status == JobRunStatus.Running ? 1 : 0,
            MaxAttempts = 3,
            Progress = status == JobRunStatus.Running ? 50 : 0,
            TargetEntityId = targetEntityId,
            AvailableAt = createdAt,
            CreatedAt = createdAt,
            StartedAt = status == JobRunStatus.Running ? createdAt.AddMinutes(1) : null,
            FinishedAt = status == JobRunStatus.Failed ? createdAt.AddMinutes(1) : null
        };
}
