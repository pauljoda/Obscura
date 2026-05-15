using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Media.Persistence;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class LibraryScanPersistenceServiceTests
{
    [Fact]
    public async Task DownstreamNeedsProbeWhenLegacyTechnicalRowsLackMediaSources()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        SeedVideo(db, videoId);
        db.EntityTechnical.Add(new EntityTechnicalRow
        {
            EntityId = videoId,
            DurationSeconds = 60,
            Width = 1920,
            Height = 1080,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        var needs = await service.CheckDownstreamNeedsBatchAsync([videoId], CancellationToken.None);

        Assert.True(needs[videoId].NeedsProbe);
    }

    [Fact]
    public async Task DownstreamNeedsTrickplayWhenThumbnailExistsWithoutTrickplayInfo()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        SeedVideo(db, videoId);
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(),
            EntityId = videoId,
            Role = EntityFileRole.Thumbnail,
            Path = "/assets/videos/222/thumb.jpg",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        var needs = await service.CheckDownstreamNeedsBatchAsync([videoId], CancellationToken.None);

        Assert.False(needs[videoId].NeedsPreview);
        Assert.True(needs[videoId].NeedsTrickplay);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"library-scan-persistence-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedVideo(ObscuraDbContext db, Guid videoId)
    {
        db.Entities.Add(new EntityRow
        {
            Id = videoId,
            KindCode = EntityKindRegistry.Video.Code,
            Title = "Video",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(),
            EntityId = videoId,
            Role = EntityFileRole.Source,
            Path = $"/media/{videoId}.mkv",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
