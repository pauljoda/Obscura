using Microsoft.EntityFrameworkCore;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Queue;

namespace Obscura.Infrastructure.Tests;

public sealed class JobQueueServiceTests
{
    [Fact]
    public async Task EnqueueCreatesQueuedJobAndListReturnsNewestFirst()
    {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var first = await service.EnqueueAsync("scan-library", CancellationToken.None);
        var second = await service.EnqueueAsync("probe-video", CancellationToken.None);
        var jobs = await service.ListAsync(CancellationToken.None);

        Assert.Equal("queued", first.Status);
        Assert.Equal("probe-video", second.Type);
        Assert.Equal(2, jobs.Count);
        Assert.Equal(second.Id, jobs[0].Id);
        Assert.Equal(first.Id, jobs[1].Id);
    }

    [Fact]
    public async Task ClaimCompleteAndFailAdvanceJobLifecycle()
    {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var created = await service.EnqueueAsync("noop", CancellationToken.None);
        var claimed = await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.CompleteAsync(created.Id, "done", CancellationToken.None);
        var completed = await db.JobRuns.FindAsync(created.Id);

        Assert.NotNull(claimed);
        Assert.Equal(created.Id, claimed.Id);
        Assert.Equal("running", claimed.Status);
        Assert.NotNull(completed);
        Assert.Equal("completed", completed.Status);
        Assert.Equal(100, completed.Progress);
        Assert.Equal("done", completed.Message);
    }

    [Fact]
    public async Task FailedClaimRetriesUntilMaxAttempts()
    {
        await using var db = CreateContext();
        var service = new JobQueueService(db);

        var created = await service.EnqueueAsync("unknown", CancellationToken.None);
        await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.FailAsync(created.Id, "missing handler", TimeSpan.Zero, CancellationToken.None);
        await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.FailAsync(created.Id, "missing handler", TimeSpan.Zero, CancellationToken.None);
        await service.ClaimNextAsync("worker-1", CancellationToken.None);
        await service.FailAsync(created.Id, "missing handler", TimeSpan.Zero, CancellationToken.None);
        var failed = await db.JobRuns.FindAsync(created.Id);

        Assert.NotNull(failed);
        Assert.Equal("failed", failed.Status);
        Assert.Equal(3, failed.Attempts);
        Assert.NotNull(failed.FinishedAt);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"job-queue-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }
}
