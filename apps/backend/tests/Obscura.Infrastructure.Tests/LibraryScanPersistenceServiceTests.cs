using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Media.Persistence;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class LibraryScanPersistenceServiceTests {
    [Fact]
    public async Task DownstreamNeedsProbeWhenTechnicalRowsLackMediaSources() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        SeedVideo(db, videoId);
        db.EntityTechnical.Add(new EntityTechnicalRow {
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
    public async Task DownstreamNeedsTrickplayWhenThumbnailExistsWithoutTrickplayInfo() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        SeedVideo(db, videoId);
        db.EntityFiles.Add(new EntityFileRow {
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
    public async Task DownstreamNeedsSubtitleExtractionWhenStoredSubtitleFileIsMissing() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        SeedVideo(db, videoId);
        db.VideoDetails.Add(new VideoDetailRow {
            EntityId = videoId,
            SubtitlesExtractedAt = DateTimeOffset.UtcNow
        });
        db.EntitySubtitles.Add(new EntitySubtitleRow {
            Id = Guid.NewGuid(),
            EntityId = videoId,
            Language = "eng",
            Format = "vtt",
            Source = EntitySubtitleSource.Embedded,
            StoragePath = "/tmp/obscura/missing-subtitle.vtt",
            SourceFormat = "vtt",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        var needs = await service.CheckDownstreamNeedsBatchAsync([videoId], CancellationToken.None);

        Assert.True(needs[videoId].NeedsSubtitleExtraction);
    }

    [Fact]
    public async Task UpsertSubtitleRefreshesExistingStreamInsteadOfDuplicatingIt() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var subtitleId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        SeedVideo(db, videoId);
        db.EntitySubtitles.Add(new EntitySubtitleRow {
            Id = subtitleId,
            EntityId = videoId,
            Language = "eng",
            Format = "vtt",
            Source = EntitySubtitleSource.Embedded,
            StoragePath = "/tmp/obscura/stale.vtt",
            SourceFormat = "vtt",
            SourcePath = "3",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        await service.UpsertSubtitleAsync(
            videoId,
            "eng",
            "SDH",
            "vtt",
            EntitySubtitleSource.Embedded,
            "/data/cache/videos/444/subtitles/embedded-eng-3.vtt",
            "vtt",
            3,
            CancellationToken.None);

        var subtitle = Assert.Single(db.EntitySubtitles.Where(row => row.EntityId == videoId));
        Assert.Equal(subtitleId, subtitle.Id);
        Assert.Equal("/data/cache/videos/444/subtitles/embedded-eng-3.vtt", subtitle.StoragePath);
        Assert.Equal("SDH", subtitle.Label);
    }

    [Fact]
    public async Task UpsertSubtitleRefreshesLegacyLanguageRowWhenStoredFileIsMissing() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var subtitleId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        SeedVideo(db, videoId);
        db.EntitySubtitles.Add(new EntitySubtitleRow {
            Id = subtitleId,
            EntityId = videoId,
            Language = "eng",
            Format = "vtt",
            Source = EntitySubtitleSource.Embedded,
            StoragePath = "/tmp/obscura/stale.vtt",
            SourceFormat = "vtt",
            SourcePath = null,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        await service.UpsertSubtitleAsync(
            videoId,
            "eng",
            "SDH",
            "vtt",
            EntitySubtitleSource.Embedded,
            "/data/cache/videos/666/subtitles/embedded-eng-3.vtt",
            "vtt",
            3,
            CancellationToken.None);

        var subtitle = Assert.Single(db.EntitySubtitles.Where(row => row.EntityId == videoId));
        Assert.Equal(subtitleId, subtitle.Id);
        Assert.Equal("/data/cache/videos/666/subtitles/embedded-eng-3.vtt", subtitle.StoragePath);
        Assert.Equal("3", subtitle.SourcePath);
    }

    [Fact]
    public async Task UpsertSubtitleRemovesMissingLegacyConflictBeforeNormalizingStreamLanguage() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var legacyId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var streamId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        SeedVideo(db, videoId);
        db.EntitySubtitles.AddRange(
            new EntitySubtitleRow {
                Id = legacyId,
                EntityId = videoId,
                Language = "eng",
                Format = "vtt",
                Source = EntitySubtitleSource.Embedded,
                StoragePath = "/tmp/obscura/stale.vtt",
                SourceFormat = "vtt",
                SourcePath = null,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntitySubtitleRow {
                Id = streamId,
                EntityId = videoId,
                Language = "eng.3",
                Format = "vtt",
                Source = EntitySubtitleSource.Embedded,
                StoragePath = "/tmp/obscura/url-shaped.vtt",
                SourceFormat = "subrip",
                SourcePath = "3",
                CreatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var service = new LibraryScanPersistenceService(db);
        await service.UpsertSubtitleAsync(
            videoId,
            "eng",
            "SDH",
            "vtt",
            EntitySubtitleSource.Embedded,
            "/data/cache/videos/888/subtitles/embedded-eng-3.vtt",
            "subrip",
            3,
            CancellationToken.None);

        var subtitle = Assert.Single(db.EntitySubtitles.Where(row => row.EntityId == videoId));
        Assert.Equal(streamId, subtitle.Id);
        Assert.Equal("eng", subtitle.Language);
        Assert.Equal("/data/cache/videos/888/subtitles/embedded-eng-3.vtt", subtitle.StoragePath);
        Assert.Equal("3", subtitle.SourcePath);
    }

    [Fact]
    public async Task UpsertVideosBatchMaterializesSeasonHierarchyAndReusesMigratedSeries() {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var rootId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var now = DateTimeOffset.UtcNow;
        db.Entities.Add(new EntityRow {
            Id = seriesId,
            KindCode = EntityKindRegistry.VideoSeries.Code,
            Title = "The Chair Company",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.EntitySources.Add(new EntitySourceRow {
            EntityId = seriesId,
            Code = "folder",
            Value = "/media/The Chair Company",
            UpdatedAt = now
        });
        db.EntityRatings.Add(new EntityRatingRow {
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
        Assert.Equal(1, season.SortOrder);

        Assert.Equal(seriesId, season.ParentEntityId);
        Assert.Equal(1, season.SortOrder);
        var video = Assert.Single(db.Entities.Where(entity => entity.Id == videoId));
        Assert.Equal(season.Id, video.ParentEntityId);
        Assert.Equal(1, video.SortOrder);
        Assert.Contains(db.EntityPositions, position =>
            position.EntityId == season.Id &&
            position.Code == "season" &&
            position.Value == 1);
        Assert.Contains(db.EntityPositions, position =>
            position.EntityId == videoId &&
            position.Code == "episode" &&
            position.Value == 1);
    }

    private static ObscuraDbContext CreateContext() {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"library-scan-persistence-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedVideo(ObscuraDbContext db, Guid videoId) {
        db.Entities.Add(new EntityRow {
            Id = videoId,
            KindCode = EntityKindRegistry.Video.Code,
            Title = "Video",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow {
            Id = Guid.NewGuid(),
            EntityId = videoId,
            Role = EntityFileRole.Source,
            Path = $"/media/{videoId}.mkv",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
