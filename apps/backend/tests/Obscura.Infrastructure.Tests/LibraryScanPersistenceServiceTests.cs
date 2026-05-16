using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
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

    [Fact]
    public async Task UpsertVideosBatchMaterializesSeasonHierarchyAndReusesMigratedSeries()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var rootId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var now = DateTimeOffset.UtcNow;
        db.Entities.Add(new EntityRow
        {
            Id = seriesId,
            KindCode = EntityKindRegistry.VideoSeries.Code,
            Title = "The Chair Company",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.EntitySources.Add(new EntitySourceRow
        {
            EntityId = seriesId,
            Code = "folder",
            Value = "/media/The Chair Company",
            UpdatedAt = now
        });
        db.EntityRatings.Add(new EntityRatingRow
        {
            EntityId = seriesId,
            Value = 4,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        var ids = await service.UpsertVideosBatchAsync([
            new VideoUpsertItem(
                "/media/The Chair Company/Season 1/The Chair Company - S01E01.mkv",
                "Life goes by too fast",
                rootId,
                IsNsfw: false,
                new VideoSeriesScanInfo("/media/The Chair Company", "The Chair Company"),
                new VideoSeasonScanInfo("/media/The Chair Company/Season 1", "Season 1", 1),
                EpisodeNumber: 1,
                AbsoluteEpisodeNumber: null)
        ], CancellationToken.None);

        var videoId = Assert.Single(ids);
        Assert.Equal(seriesId, Assert.Single(db.Entities.Where(entity => entity.KindCode == EntityKindRegistry.VideoSeries.Code)).Id);
        Assert.Equal(4, Assert.Single(db.EntityRatings.Where(rating => rating.EntityId == seriesId)).Value);

        var season = Assert.Single(db.Entities.Where(entity => entity.KindCode == EntityKindRegistry.VideoSeason.Code));
        var seasonDetail = Assert.Single(db.VideoSeasonDetails);
        Assert.Equal(season.Id, seasonDetail.EntityId);
        Assert.Equal(seriesId, seasonDetail.SeriesEntityId);
        Assert.Equal(1, seasonDetail.SeasonNumber);

        Assert.Contains(db.EntityHierarchyLinks, link =>
            link.ParentEntityId == seriesId &&
            link.ChildEntityId == season.Id &&
            link.Relationship == EntityRelationshipRegistry.Season.Code &&
            link.SortOrder == 1);
        Assert.Contains(db.EntityHierarchyLinks, link =>
            link.ParentEntityId == season.Id &&
            link.ChildEntityId == videoId &&
            link.Relationship == EntityRelationshipRegistry.Episode.Code &&
            link.SortOrder == 1);
        Assert.DoesNotContain(db.EntityHierarchyLinks, link =>
            link.ParentEntityId == seriesId &&
            link.ChildEntityId == videoId &&
            link.Relationship == EntityRelationshipRegistry.Episode.Code);
        Assert.Contains(db.EntityPositions, position =>
            position.EntityId == season.Id &&
            position.Code == "season" &&
            position.Value == 1);
        Assert.Contains(db.EntityPositions, position =>
            position.EntityId == videoId &&
            position.Code == "episode" &&
            position.Value == 1);
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
