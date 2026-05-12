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

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"job-queue-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }
}
