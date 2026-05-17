using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class EntityProjectionServiceTests
{
    [Fact]
    public async Task ListProjectsSharedCapabilitiesForVideos()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var tagId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var studioId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var personId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        SeedEntity(db, videoId, "video", "A Quiet Scene");
        SeedEntity(db, tagId, "tag", "Favorite");
        SeedEntity(db, studioId, "studio", "Obscura Studio");
        SeedEntity(db, personId, "person", "Ada Person");
        db.EntityRatings.Add(new EntityRatingRow { EntityId = videoId, Value = 4 });
        db.EntityDescriptions.Add(new EntityDescriptionRow
        {
            EntityId = videoId,
            Value = "Shared description.",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFlags.Add(new EntityFlagRow
        {
            EntityId = videoId,
            IsFavorite = true,
            IsNsfw = false,
            IsOrganized = true
        });
        db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow
        {
            EntityId = videoId,
            RelationshipCode = "tags",
            Label = "Tags",
            TargetEntityId = tagId,
            TargetKindCode = "tag",
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow
        {
            EntityId = videoId,
            RelationshipCode = "studio",
            Label = "Studio",
            TargetEntityId = studioId,
            TargetKindCode = "studio",
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityRelationshipLinks.Add(new EntityRelationshipLinkRow
        {
            EntityId = videoId,
            RelationshipCode = "cast",
            Label = "Cast",
            TargetEntityId = personId,
            TargetKindCode = "person",
            SortOrder = 1,
            MetadataJson = """{"role":"person","character":"Lead"}""",
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityPlayback.Add(new EntityPlaybackRow
        {
            EntityId = videoId,
            PlayCount = 2,
            PlayDurationSeconds = 120,
            ResumeSeconds = 45,
            LastPlayedAt = DateTimeOffset.Parse("2026-05-12T12:00:00Z"),
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityCounters.Add(new EntityCounterRow
        {
            EntityId = videoId,
            Code = "orgasm",
            Value = 3,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityUrls.Add(new EntityUrlRow
        {
            Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            EntityId = videoId,
            Url = "https://example.test/videos/a-quiet-scene",
            Label = "Example",
            SortOrder = 0,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityExternalIds.Add(new EntityExternalIdRow
        {
            Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            EntityId = videoId,
            Provider = "tmdb",
            Value = "12345",
            Url = "https://www.themoviedb.org/movie/12345",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
            EntityId = videoId,
            Role = EntityFileRole.Thumbnail,
            Path = "/assets/videos/11111111-1111-1111-1111-111111111111/card",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777778"),
            EntityId = videoId,
            Role = EntityFileRole.Source,
            Path = "/media/videos/a-quiet-scene.mkv",
            MimeType = "video/x-matroska",
            SizeBytes = 1024,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777779"),
            EntityId = videoId,
            Role = EntityFileRole.Logo,
            Path = "/assets/videos/11111111-1111-1111-1111-111111111111/logo.png",
            MimeType = "image/png",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777780"),
            EntityId = videoId,
            Role = EntityFileRole.Trickplay,
            Path = "/assets/videos/11111111-1111-1111-1111-111111111111/trickplay.vtt",
            MimeType = "text/vtt",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFileFingerprints.Add(new EntityFileFingerprintRow
        {
            Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            EntityId = videoId,
            Algorithm = FingerprintAlgorithm.Oshash,
            Value = "abc123",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var response = await service.ListVideosAsync(hideNsfw: false, CancellationToken.None);

        var card = Assert.Single(response.Items);
        Assert.Equal(videoId, card.Id);
        Assert.Equal("video", card.Kind.Code);
        Assert.Equal("Shared description.", card.GetCapability(CapabilityRegistry.Description).Value);
        Assert.Equal(4, card.GetCapability(CapabilityRegistry.Rating).Value?.Value);
        var tagRelationship = Assert.Single(card.Relationships.Groups.Where(group => group.Code == "tags"));
        Assert.Equal("tag", tagRelationship.Kind.Code);
        Assert.Equal(tagId, Assert.Single(tagRelationship.Items).EntityId);
        var studioRelationship = Assert.Single(card.Relationships.Groups.Where(group => group.Code == "studio"));
        Assert.Equal("studio", studioRelationship.Kind.Code);
        Assert.Equal(studioId, Assert.Single(studioRelationship.Items).EntityId);
        var creditRelationship = Assert.Single(card.Relationships.Groups.Where(group => group.Code == "cast"));
        Assert.Equal("person", creditRelationship.Kind.Code);
        var credit = Assert.Single(creditRelationship.Items);
        Assert.Equal(personId, credit.EntityId);
        Assert.Contains("Lead", credit.MetadataJson ?? string.Empty, StringComparison.Ordinal);
        var links = card.GetCapability(CapabilityRegistry.Links);
        var url = Assert.Single(links.Urls);
        Assert.Equal("https://example.test/videos/a-quiet-scene", url.Url);
        Assert.Equal("Example", url.Label);
        var externalId = Assert.Single(links.ExternalIds);
        Assert.Equal("tmdb", externalId.Provider);
        Assert.Equal("12345", externalId.Value);
        Assert.Equal("https://www.themoviedb.org/movie/12345", externalId.Url);
        var images = card.GetCapability(CapabilityRegistry.Images);
        Assert.Equal("/assets/videos/11111111-1111-1111-1111-111111111111/card", images.ThumbnailUrl);
        Assert.Contains(images.Items, asset => asset.Kind == EntityFileRole.Thumbnail && asset.Path == "/assets/videos/11111111-1111-1111-1111-111111111111/card");
        Assert.Contains(images.Items, asset => asset.Kind == EntityFileRole.Logo && asset.Path.EndsWith("/logo.png", StringComparison.Ordinal));
        Assert.Contains(images.Items, asset => asset.Kind == EntityFileRole.Trickplay && asset.Path.EndsWith("/trickplay.vtt", StringComparison.Ordinal));
        var files = card.GetCapability(CapabilityRegistry.Files).Items;
        Assert.Contains(files, file => file.Role == EntityFileRole.Thumbnail && file.Path == "/assets/videos/11111111-1111-1111-1111-111111111111/card");
        Assert.Contains(files, file => file.Role == EntityFileRole.Source && file.Path == "/media/videos/a-quiet-scene.mkv");
        var fingerprint = Assert.Single(card.GetCapability(CapabilityRegistry.Fingerprints).Items);
        Assert.Equal(FingerprintAlgorithm.Oshash, fingerprint.Algorithm);
        Assert.Equal("abc123", fingerprint.Value);
        var playback = card.GetCapability(CapabilityRegistry.Playback).Value;
        Assert.Equal(2, playback.PlayCount);
        Assert.Equal(TimeSpan.FromSeconds(45), playback.ResumeTime);
        var counter = Assert.Single(card.GetCapability(CapabilityRegistry.Counters).Items);
        Assert.Equal("orgasm", counter.Code);
        Assert.Equal(3, counter.Value);
        var flags = card.GetCapability(CapabilityRegistry.Flags);
        Assert.True(flags.IsFavorite);
        Assert.False(flags.IsNsfw);
        Assert.True(flags.IsOrganized);
    }

    [Fact]
    public async Task RatingUpdatesApplyAcrossEntityKinds()
    {
        await using var db = CreateContext();
        var imageId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        SeedEntity(db, imageId, "image", "Still Frame");
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var rated = await service.UpdateRatingAsync(
            imageId,
            5,
            CancellationToken.None);
        var cleared = await service.UpdateRatingAsync(
            imageId,
            null,
            CancellationToken.None);

        Assert.Equal(5, rated?.GetCapability(CapabilityRegistry.Rating).Value?.Value);
        Assert.Null(cleared?.GetCapability(CapabilityRegistry.Rating).Value);
        Assert.Empty(db.EntityRatings);
    }

    [Fact]
    public async Task MarkerWritesRefreshMarkerCapability()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("31313131-3131-3131-3131-313131313131");
        SeedEntity(db, videoId, "video", "Marked Video");
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var created = await service.CreateMarkerAsync(
            videoId,
            "Cold Open",
            seconds: 12,
            endSeconds: 18,
            CancellationToken.None);
        var marker = Assert.Single(created?.GetCapability(CapabilityRegistry.Markers).Items!);

        var updated = await service.UpdateMarkerAsync(
            videoId,
            marker.Id,
            "Opening Beat",
            seconds: 14,
            endSeconds: null,
            CancellationToken.None);

        marker = Assert.Single(updated?.GetCapability(CapabilityRegistry.Markers).Items!);
        Assert.Equal("Opening Beat", marker.Title);
        Assert.Equal(14, marker.Seconds);
        Assert.Null(marker.EndSeconds);

        var deleted = await service.DeleteMarkerAsync(videoId, marker.Id, CancellationToken.None);

        Assert.False(deleted?.TryGetCapability(CapabilityRegistry.Markers, out _) ?? true);
        Assert.Empty(db.EntityMarkers);
    }

    [Fact]
    public async Task ListHidesNsfwEntitiesWhenRequested()
    {
        await using var db = CreateContext();
        var safeId = Guid.Parse("37373737-3737-3737-3737-373737373737");
        var nsfwId = Guid.Parse("38383838-3838-3838-3838-383838383838");
        SeedEntity(db, safeId, "video", "Safe Feature");
        SeedEntity(db, nsfwId, "video", "Hidden Feature");
        db.EntityFlags.Add(new EntityFlagRow
        {
            EntityId = safeId,
            IsFavorite = false,
            IsNsfw = false,
            IsOrganized = false
        });
        db.EntityFlags.Add(new EntityFlagRow
        {
            EntityId = nsfwId,
            IsFavorite = false,
            IsNsfw = true,
            IsOrganized = false
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var response = await service.ListAsync(
            EntityKindRegistry.Video,
            query: null,
            cursor: null,
            hideNsfw: true,
            CancellationToken.None);

        var card = Assert.Single(response.Items);
        Assert.Equal(safeId, card.Id);
    }

    [Fact]
    public async Task VideoDetailComposesKindSpecificFieldsWithCapabilities()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        SeedEntity(db, videoId, "video", "Feature");
        db.VideoDetails.Add(new VideoDetailRow
        {
            EntityId = videoId
        });
        SeedDescription(db, videoId, "A projected video detail.");
        SeedTechnical(db, videoId, durationSeconds: 90, width: 1920, height: 1080);
        db.EntityRatings.Add(new EntityRatingRow { EntityId = videoId, Value = 3 });
        db.EntityMarkers.Add(new EntityMarkerRow
        {
            Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            EntityId = videoId,
            Title = "Opening",
            Seconds = 12.5,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntitySubtitles.Add(new EntitySubtitleRow
        {
            Id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            EntityId = videoId,
            Language = "en",
            Label = "English",
            Format = "vtt",
            Source = EntitySubtitleSource.Manual,
            StoragePath = "/data/subtitles/feature.vtt",
            SourceFormat = "srt",
            SourcePath = "/media/feature.srt",
            IsDefault = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var detail = await service.GetVideoAsync(videoId, CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal("Feature", detail.Title);
        Assert.Equal(TimeSpan.FromSeconds(90), detail.Technical?.Duration);
        Assert.Equal(1920, detail.Technical?.Width);
        Assert.Equal(1080, detail.Technical?.Height);
        Assert.Equal(3, detail.GetCapability(CapabilityRegistry.Rating).Value?.Value);
        var marker = Assert.Single(detail.MarkerCapability!.Items);
        Assert.Equal("Opening", marker.Title);
        Assert.Equal(12.5, marker.Seconds);
        var subtitle = Assert.Single(detail.SubtitleCapability!.Items);
        Assert.Equal("en", subtitle.Language);
        Assert.Equal("English", subtitle.Label);
        Assert.True(subtitle.IsDefault);
    }

    [Fact]
    public async Task SeriesListAndDetailUseSharedEntityCapabilities()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var episodeId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        SeedEntity(db, seriesId, "video-series", "Collected Episodes");
        SeedEntity(db, episodeId, "video", "Pilot", parentEntityId: seriesId, sortOrder: 1);
        db.EntityRatings.Add(new EntityRatingRow { EntityId = seriesId, Value = 5 });
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seriesId,
            ChildEntityId = episodeId,
            ChildKindCode = EntityKindRegistry.Video.Code,
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var list = await service.ListSeriesAsync(hideNsfw: false, CancellationToken.None);
        var detail = await service.GetSeriesAsync(seriesId, CancellationToken.None);

        var card = Assert.Single(list.Items);
        Assert.Equal(seriesId, card.Id);
        Assert.Equal("video-series", card.Kind.Code);
        Assert.Equal(5, card.GetCapability(CapabilityRegistry.Rating).Value?.Value);
        Assert.NotNull(detail);
        Assert.Equal("Collected Episodes", detail.Title);
        Assert.Equal(VideoSeriesRenderingMode.Flat, detail.RenderingMode);
        Assert.Empty(detail.Children);
        var video = Assert.Single(detail.Videos);
        Assert.Equal(episodeId, video.Id);
    }

    [Fact]
    public async Task SeriesDetailProjectsSeasonChildrenSeparatelyFromFlatEpisodes()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var seasonId = Guid.Parse("13131313-1313-1313-1313-131313131313");
        var episodeId = Guid.Parse("14141414-1414-1414-1414-141414141414");
        SeedEntity(db, seriesId, "video-series", "Seasoned Series");
        SeedEntity(db, seasonId, "video-season", "Season 1", parentEntityId: seriesId, sortOrder: 1);
        SeedEntity(db, episodeId, "video", "Episode 1", parentEntityId: seasonId, sortOrder: 1);
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seriesId,
            ChildEntityId = seasonId,
            ChildKindCode = EntityKindRegistry.VideoSeason.Code,
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seasonId,
            ChildEntityId = episodeId,
            ChildKindCode = EntityKindRegistry.Video.Code,
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var detail = await service.GetSeriesAsync(seriesId, CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal(VideoSeriesRenderingMode.Seasons, detail.RenderingMode);
        var season = Assert.Single(detail.Children);
        Assert.Equal(seasonId, season.Id);
        Assert.Empty(detail.Videos);
    }

    [Fact]
    public async Task SeasonDetailProjectsEpisodesInHierarchyOrder()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("24242424-2424-2424-2424-242424242424");
        var seasonId = Guid.Parse("25252525-2525-2525-2525-252525252525");
        var episodeTwoId = Guid.Parse("26262626-2626-2626-2626-262626262626");
        var episodeOneId = Guid.Parse("27272727-2727-2727-2727-272727272727");
        SeedEntity(db, seriesId, "video-series", "Ordered Series");
        SeedEntity(db, seasonId, "video-season", "Season 1", parentEntityId: seriesId, sortOrder: 1);
        SeedEntity(db, episodeTwoId, "video", "Episode 2", parentEntityId: seasonId, sortOrder: 2);
        SeedEntity(db, episodeOneId, "video", "Episode 1", parentEntityId: seasonId, sortOrder: 1);
        db.VideoSeasonDetails.Add(new VideoSeasonDetailRow
        {
            EntityId = seasonId,
            SeasonNumber = 1
        });
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seriesId,
            ChildEntityId = seasonId,
            ChildKindCode = EntityKindRegistry.VideoSeason.Code,
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seasonId,
            ChildEntityId = episodeTwoId,
            ChildKindCode = EntityKindRegistry.Video.Code,
            SortOrder = 2,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seasonId,
            ChildEntityId = episodeOneId,
            ChildKindCode = EntityKindRegistry.Video.Code,
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        SeedPosition(db, episodeTwoId, "episode", 2);
        SeedPosition(db, episodeOneId, "episode", 1);
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var detail = await service.GetSeasonAsync(seasonId, CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal(seriesId, detail.ParentEntityId);
        Assert.Equal([episodeOneId, episodeTwoId], detail.Videos.Select(video => video.Id).ToArray());
    }

    [Fact]
    public async Task SeriesDetailProjectsGenericChildrenByKindFromEntityChildLinks()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("38383838-3838-3838-3838-383838383838");
        var seasonId = Guid.Parse("39393939-3939-3939-3939-393939393939");
        var episodeId = Guid.Parse("40404040-4040-4040-4040-404040404040");
        SeedEntity(db, seriesId, "video-series", "Generic Series");
        SeedEntity(db, seasonId, "video-season", "Season 1", parentEntityId: seriesId, sortOrder: 1);
        SeedEntity(db, episodeId, "video", "Episode 1", parentEntityId: seasonId, sortOrder: 1);
        SeedDate(db, seriesId, "first-air", "2020-01-01", new DateOnly(2020, 1, 1), "day");
        SeedDate(db, seriesId, "end-air", "2024", new DateOnly(2024, 1, 1), "year");
        db.EntityChildLinks.AddRange(
            new EntityChildLinkRow
            {
                ParentEntityId = seriesId,
                ChildEntityId = seasonId,
                ChildKindCode = EntityKindRegistry.VideoSeason.Code,
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = seasonId,
                ChildEntityId = episodeId,
                ChildKindCode = EntityKindRegistry.Video.Code,
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var series = await service.GetSeriesAsync(seriesId, CancellationToken.None);
        var season = await service.GetSeasonAsync(seasonId, CancellationToken.None);

        Assert.NotNull(series);
        var seasonGroup = Assert.Single(series.ChildrenByKind.Sets);
        Assert.Equal(EntityKindRegistry.VideoSeason.Code, seasonGroup.Kind.Code);
        Assert.Equal(seasonId, Assert.Single(seasonGroup.Items).Id);
        Assert.Equal(VideoSeriesRenderingMode.Seasons, series.RenderingMode);
        Assert.Equal("Aired", series.GetCapability(CapabilityRegistry.Lifetime).Label);
        Assert.NotNull(season);
        Assert.Equal(seriesId, season.ParentEntityId);
        Assert.Equal(episodeId, Assert.Single(season.ChildrenByKind.Get(EntityKindRegistry.Video)).Id);
    }

    [Fact]
    public async Task GenericChildLinksLoadOrderedChildrenAndSkipsDeletedEntities()
    {
        await using var db = CreateContext();
        var bookId = Guid.Parse("15151515-1515-1515-1515-151515151515");
        var volumeId = Guid.Parse("16161616-1616-1616-1616-161616161616");
        var chapterId = Guid.Parse("17171717-1717-1717-1717-171717171717");
        var firstPageId = Guid.Parse("18181818-1818-1818-1818-181818181818");
        var deletedPageId = Guid.Parse("19191919-1919-1919-1919-191919191919");
        SeedEntity(db, bookId, "book", "Book Root");
        SeedEntity(db, volumeId, "book-volume", "Volume 1", parentEntityId: bookId, sortOrder: 1);
        SeedEntity(db, chapterId, "book-chapter", "Chapter 1", parentEntityId: volumeId, sortOrder: 1);
        SeedEntity(db, firstPageId, "book-page", "Page 1", parentEntityId: chapterId, sortOrder: 2);
        db.Entities.Add(new EntityRow
        {
            Id = deletedPageId,
            KindCode = "book-page",
            Title = "Deleted Page",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            DeletedAt = DateTimeOffset.UtcNow
        });
        db.EntityChildLinks.AddRange(
            new EntityChildLinkRow
            {
                ParentEntityId = bookId,
                ChildEntityId = volumeId,
                ChildKindCode = EntityKindRegistry.BookVolume.Code,
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = volumeId,
                ChildEntityId = chapterId,
                ChildKindCode = EntityKindRegistry.BookChapter.Code,
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = chapterId,
                ChildEntityId = deletedPageId,
                ChildKindCode = EntityKindRegistry.BookPage.Code,
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = chapterId,
                ChildEntityId = firstPageId,
                ChildKindCode = EntityKindRegistry.BookPage.Code,
                SortOrder = 2,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var volumes = await service.ListChildrenAsync(bookId, EntityKindRegistry.BookVolume, CancellationToken.None);
        var volume = Assert.Single(volumes);
        Assert.Equal(volumeId, volume.Id);
        var chapters = await service.ListChildrenAsync(volume.Id, EntityKindRegistry.BookChapter, CancellationToken.None);
        var chapter = Assert.Single(chapters);
        Assert.Equal(chapterId, chapter.Id);
        var pages = await service.ListChildrenAsync(chapter.Id, EntityKindRegistry.BookPage, CancellationToken.None);
        var page = Assert.Single(pages);
        Assert.Equal(firstPageId, page.Id);
        Assert.Equal(2, page.SortOrder);
    }

    [Fact]
    public async Task GenericChildLinksUseCreatedAtWhenSortOrderConflicts()
    {
        await using var db = CreateContext();
        var seasonId = Guid.Parse("8a8a8a8a-8a8a-8a8a-8a8a-8a8a8a8a8a8a");
        var olderEpisodeId = Guid.Parse("8b8b8b8b-8b8b-8b8b-8b8b-8b8b8b8b8b8b");
        var newerEpisodeId = Guid.Parse("8c8c8c8c-8c8c-8c8c-8c8c-8c8c8c8c8c8c");
        var older = new DateTimeOffset(2026, 5, 17, 1, 0, 0, TimeSpan.Zero);
        var newer = older.AddMinutes(5);
        SeedEntity(db, seasonId, "video-season", "Season");
        SeedEntity(db, newerEpisodeId, "video", "Episode 2 Duplicate B", parentEntityId: seasonId, sortOrder: 2, createdAt: newer);
        SeedEntity(db, olderEpisodeId, "video", "Episode 2 Duplicate A", parentEntityId: seasonId, sortOrder: 2, createdAt: older);
        db.EntityChildLinks.AddRange(
            new EntityChildLinkRow
            {
                ParentEntityId = seasonId,
                ChildEntityId = newerEpisodeId,
                ChildKindCode = EntityKindRegistry.Video.Code,
                SortOrder = 2,
                IsStructural = true,
                CreatedAt = newer
            },
            new EntityChildLinkRow
            {
                ParentEntityId = seasonId,
                ChildEntityId = olderEpisodeId,
                ChildKindCode = EntityKindRegistry.Video.Code,
                SortOrder = 2,
                IsStructural = true,
                CreatedAt = older
            });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var children = await service.ListChildrenAsync(seasonId, EntityKindRegistry.Video, CancellationToken.None);

        Assert.Equal([olderEpisodeId, newerEpisodeId], children.Select(child => child.Id).ToArray());
    }

    [Fact]
    public async Task CollectionChildrenUseSharedEntityProjections()
    {
        await using var db = CreateContext();
        var collectionId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var imageId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var audioId = Guid.Parse("abababab-abab-abab-abab-abababababab");
        SeedEntity(db, collectionId, "collection", "Reference Set");
        SeedEntity(db, imageId, "image", "Still");
        SeedEntity(db, audioId, "audio-track", "Cue");
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = collectionId,
            ChildEntityId = imageId,
            ChildKindCode = EntityKindRegistry.Image.Code,
            SortOrder = 2,
            IsStructural = false,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = collectionId,
            ChildEntityId = audioId,
            ChildKindCode = EntityKindRegistry.AudioTrack.Code,
            SortOrder = 3,
            IsStructural = false,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityRatings.Add(new EntityRatingRow { EntityId = imageId, Value = 4 });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var children = await service.ListChildrenAsync(
            collectionId,
            EntityKindRegistry.Image,
            CancellationToken.None);

        var child = Assert.Single(children);
        Assert.Equal(imageId, child.Id);
        Assert.Equal("image", child.Kind.Code);
        Assert.Equal(4, child.GetCapability(CapabilityRegistry.Rating).Value?.Value);
    }

    [Fact]
    public async Task DetailHydratorsProjectTypedMediaTaxonomyAndCollectionAggregates()
    {
        await using var db = CreateContext();
        var imageId = Guid.Parse("20202020-2020-2020-2020-202020202020");
        var galleryId = Guid.Parse("21212121-2121-2121-2121-212121212121");
        var bookId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var audioLibraryId = Guid.Parse("23232323-2323-2323-2323-232323232323");
        var audioTrackId = Guid.Parse("24242424-2424-2424-2424-242424242424");
        var personId = Guid.Parse("25252525-2525-2525-2525-252525252525");
        var studioId = Guid.Parse("26262626-2626-2626-2626-262626262626");
        var tagId = Guid.Parse("27272727-2727-2727-2727-272727272727");
        var collectionId = Guid.Parse("28282828-2828-2828-2828-282828282828");
        SeedEntity(db, imageId, "image", "Still Frame");
        SeedEntity(db, galleryId, "gallery", "Gallery Root");
        SeedEntity(db, bookId, "book", "Book Root");
        SeedEntity(db, audioLibraryId, "audio-library", "Album Root");
        SeedEntity(db, audioTrackId, "audio-track", "Track Root");
        SeedEntity(db, personId, "person", "Ada Person");
        SeedEntity(db, studioId, "studio", "Obscura Studio");
        SeedEntity(db, tagId, "tag", "Favorite");
        SeedEntity(db, collectionId, "collection", "Reference Set");
        db.ImageDetails.Add(new ImageDetailRow
        {
            EntityId = imageId
        });
        SeedDescription(db, imageId, "Image details");
        SeedDate(db, imageId, "captured", "2026-05-12");
        SeedSource(db, imageId, "file", "/media/still.jpg");
        SeedTechnical(db, imageId, width: 800, height: 600, format: "jpg");
        SeedPosition(db, imageId, "sort", 7);
        db.GalleryDetails.Add(new GalleryDetailRow
        {
            EntityId = galleryId,
            GalleryType = GalleryType.Folder
        });
        SeedDescription(db, galleryId, "Gallery details");
        SeedDate(db, galleryId, "gallery", "2026");
        SeedSource(db, galleryId, "folder", "/media/gallery");
        SeedStat(db, galleryId, "images", 12);
        db.BookDetails.Add(new BookDetailRow
        {
            EntityId = bookId,
            BookType = BookType.Comic
        });
        SeedDescription(db, bookId, "Book summary");
        SeedSource(db, bookId, "relative", "books/book");
        SeedStat(db, bookId, "pages", 42);
        SeedStat(db, bookId, "chapters", 3);
        db.EntityProgress.Add(new EntityProgressRow
        {
            EntityId = bookId,
            Unit = "page",
            Index = 5,
            Total = 42,
            Mode = ReaderMode.Webtoon.ToCode(),
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.AudioLibraryDetails.Add(new AudioLibraryDetailRow
        {
            EntityId = audioLibraryId
        });
        SeedDescription(db, audioLibraryId, "Album summary");
        SeedDate(db, audioLibraryId, "audio-library", "2026");
        SeedSource(db, audioLibraryId, "folder", "/media/audio");
        SeedStat(db, audioLibraryId, "tracks", 9);
        db.AudioTrackDetails.Add(new AudioTrackDetailRow
        {
            EntityId = audioTrackId,
            EmbeddedArtist = "Artist",
            EmbeddedAlbum = "Album"
        });
        SeedDescription(db, audioTrackId, "Track summary");
        SeedTechnical(db, audioTrackId, durationSeconds: 90, codec: "flac");
        SeedPosition(db, audioTrackId, "track", 2);
        db.PersonDetails.Add(new PersonDetailRow
        {
            EntityId = personId,
            Country = "US"
        });
        db.StudioDetails.Add(new StudioDetailRow
        {
            EntityId = studioId
        });
        SeedDescription(db, studioId, "Studio description");
        db.TagDetails.Add(new TagDetailRow
        {
            EntityId = tagId,
            IgnoreAutoTag = true
        });
        SeedDescription(db, tagId, "Tag description");
        db.CollectionDetails.Add(new CollectionDetailRow
        {
            EntityId = collectionId,
            Mode = CollectionMode.Manual,
            CoverMode = CollectionCoverMode.Mosaic
        });
        SeedDescription(db, collectionId, "Collection description");
        SeedStat(db, collectionId, "items", 2);
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);

        var image = await service.GetImageAggregateAsync(imageId, CancellationToken.None);
        var gallery = await service.GetGalleryAggregateAsync(galleryId, CancellationToken.None);
        var book = await service.GetBookAggregateAsync(bookId, CancellationToken.None);
        var audioLibrary = await service.GetAudioLibraryAggregateAsync(audioLibraryId, CancellationToken.None);
        var audioTrack = await service.GetAudioTrackAggregateAsync(audioTrackId, CancellationToken.None);
        var person = await service.GetPersonAggregateAsync(personId, CancellationToken.None);
        var studio = await service.GetStudioAggregateAsync(studioId, CancellationToken.None);
        var tag = await service.GetTagAggregateAsync(tagId, CancellationToken.None);
        var collection = await service.GetCollectionAggregateAsync(collectionId, CancellationToken.None);

        Assert.Equal("/media/still.jpg", image?.Source?.Items.Single(source => source.Code == "file").Value);
        Assert.Equal(GalleryType.Folder, gallery?.GalleryType);
        Assert.Equal(BookType.Comic, book?.BookType);
        Assert.Equal(ReaderMode.Webtoon.ToCode(), book?.Progress?.Mode);
        Assert.Equal(9, audioLibrary?.Stats?.Items.Single(stat => stat.Code == "tracks").Value);
        Assert.Equal("flac", audioTrack?.Technical?.Codec);
        Assert.Equal("US", person?.Country);
        Assert.Equal("Studio description", studio?.Description);
        Assert.True(tag?.IgnoreAutoTag);
        Assert.Equal("Collection description", collection?.Description);
    }

    [Fact]
    public async Task DetailHydratorsProjectVideoSeriesAndStructuralBookAggregates()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("30303030-3030-3030-3030-303030303030");
        var seriesId = Guid.Parse("31313131-3131-3131-3131-313131313131");
        var seasonId = Guid.Parse("32323232-3232-3232-3232-323232323232");
        var bookId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var volumeId = Guid.Parse("34343434-3434-3434-3434-343434343434");
        var chapterId = Guid.Parse("35353535-3535-3535-3535-353535353535");
        var pageId = Guid.Parse("36363636-3636-3636-3636-363636363636");
        SeedEntity(db, videoId, "video", "Feature");
        SeedEntity(db, seriesId, "video-series", "Series");
        SeedEntity(db, seasonId, "video-season", "Season 1");
        SeedEntity(db, bookId, "book", "Book");
        SeedEntity(db, volumeId, "book-volume", "Volume 1");
        SeedEntity(db, chapterId, "book-chapter", "Chapter 1");
        SeedEntity(db, pageId, "book-page", "Page 1");
        db.VideoDetails.Add(new VideoDetailRow
        {
            EntityId = videoId
        });
        SeedDescription(db, videoId, "Feature summary");
        SeedTechnical(db, videoId, durationSeconds: 1.5, frameRate: 23.976, codec: "h264");
        db.VideoSeriesDetails.Add(new VideoSeriesDetailRow
        {
            EntityId = seriesId
        });
        SeedDescription(db, seriesId, "Series overview");
        db.VideoSeasonDetails.Add(new VideoSeasonDetailRow
        {
            EntityId = seasonId,
            SeasonNumber = 1
        });
        SeedDescription(db, seasonId, "Season overview");
        SeedDate(db, seasonId, "air", "2026");
        SeedPosition(db, seasonId, "season", 1);
        db.BookVolumeDetails.Add(new BookVolumeDetailRow
        {
            EntityId = volumeId
        });
        SeedSource(db, volumeId, "relative", "books/book/volume-1");
        SeedPosition(db, volumeId, "volume", 1);
        db.BookChapterDetails.Add(new BookChapterDetailRow
        {
            EntityId = chapterId,
        });
        SeedSource(db, chapterId, "archive", "/media/book/chapter.cbz");
        SeedStat(db, chapterId, "pages", 30);
        SeedPosition(db, chapterId, "chapter", 2);
        db.BookPageDetails.Add(new BookPageDetailRow
        {
            EntityId = pageId
        });
        SeedSource(db, pageId, "file", "/media/book/page-001.jpg");
        SeedTechnical(db, pageId, width: 1200, height: 1800);
        SeedPosition(db, pageId, "sort", 1);
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);

        var video = await service.GetVideoAsync(videoId, CancellationToken.None);
        var series = await service.GetSeriesAsync(seriesId, CancellationToken.None);
        var season = await service.GetVideoSeasonAggregateAsync(seasonId, CancellationToken.None);
        var volume = await service.GetBookVolumeAggregateAsync(volumeId, CancellationToken.None);
        var chapter = await service.GetBookChapterAggregateAsync(chapterId, CancellationToken.None);
        var page = await service.GetBookPageAggregateAsync(pageId, CancellationToken.None);

        Assert.Equal(TimeSpan.FromMilliseconds(1500), video?.Technical?.Duration);
        Assert.Equal("Series overview", series?.Description);
        Assert.Equal(VideoSeriesRenderingMode.Flat, series?.RenderingMode);
        Assert.Equal(1, season?.Position?.Items.Single(position => position.Code == "season").Value);
        Assert.Equal(1, volume?.Position?.Items.Single(position => position.Code == "volume").Value);
        Assert.Equal(30, chapter?.Stats?.Items.Single(stat => stat.Code == "pages").Value);
        Assert.Equal("/media/book/page-001.jpg", page?.Source?.Items.Single(source => source.Code == "file").Value);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"entity-projections-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedEntity(
        ObscuraDbContext db,
        Guid id,
        string kind,
        string title,
        Guid? parentEntityId = null,
        int? sortOrder = null,
        DateTimeOffset? createdAt = null)
    {
        var timestamp = createdAt ?? DateTimeOffset.UtcNow;
        db.Entities.Add(new EntityRow
        {
            Id = id,
            KindCode = kind,
            Title = title,
            ParentEntityId = parentEntityId,
            SortOrder = sortOrder,
            CreatedAt = timestamp,
            UpdatedAt = timestamp
        });
    }

    private static void SeedDescription(ObscuraDbContext db, Guid entityId, string value)
    {
        db.EntityDescriptions.Add(new EntityDescriptionRow
        {
            EntityId = entityId,
            Value = value,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    private static void SeedTechnical(
        ObscuraDbContext db,
        Guid entityId,
        double? durationSeconds = null,
        int? width = null,
        int? height = null,
        double? frameRate = null,
        string? codec = null,
        string? format = null)
    {
        db.EntityTechnical.Add(new EntityTechnicalRow
        {
            EntityId = entityId,
            DurationSeconds = durationSeconds,
            Width = width,
            Height = height,
            FrameRate = frameRate,
            Codec = codec,
            Format = format,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    private static void SeedSource(ObscuraDbContext db, Guid entityId, string code, string value)
    {
        db.EntitySources.Add(new EntitySourceRow
        {
            EntityId = entityId,
            Code = code,
            Value = value,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    private static void SeedStat(ObscuraDbContext db, Guid entityId, string code, int value)
    {
        db.EntityStats.Add(new EntityStatRow
        {
            EntityId = entityId,
            Code = code,
            Value = value,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    private static void SeedDate(ObscuraDbContext db, Guid entityId, string code, string value)
        => SeedDate(db, entityId, code, value, null, null);

    private static void SeedDate(
        ObscuraDbContext db,
        Guid entityId,
        string code,
        string value,
        DateOnly? sortableValue,
        string? precision)
    {
        db.EntityDates.Add(new EntityDateRow
        {
            EntityId = entityId,
            Code = code,
            Value = value,
            SortableValue = sortableValue,
            Precision = precision,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    private static void SeedPosition(ObscuraDbContext db, Guid entityId, string code, int value)
    {
        db.EntityPositions.Add(new EntityPositionRow
        {
            EntityId = entityId,
            Code = code,
            Value = value,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
