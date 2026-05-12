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
        db.EntityTagLinks.Add(new EntityTagLinkRow { EntityId = videoId, TagId = tagId });
        db.EntityStudioLinks.Add(new EntityStudioLinkRow
        {
            EntityId = videoId,
            StudioId = studioId,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityCreditLinks.Add(new EntityCreditLinkRow
        {
            EntityId = videoId,
            PersonEntityId = personId,
            Role = EntityCreditRole.Person,
            Character = "Lead",
            SortOrder = 1,
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
            Algorithm = "oshash",
            Value = "abc123",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var response = await service.ListVideosAsync(CancellationToken.None);

        var card = Assert.Single(response.Items);
        Assert.Equal(videoId, card.Id);
        Assert.Equal("video", card.Kind.Code);
        Assert.Equal("Shared description.", card.GetCapability(CapabilityRegistry.Description).Value);
        Assert.Equal(4, card.GetCapability(CapabilityRegistry.Rating).Value?.Value);
        Assert.Equal(["Favorite"], card.GetCapability(CapabilityRegistry.Tags).Values);
        var tag = Assert.Single(card.GetCapability(CapabilityRegistry.Tags).Items);
        Assert.Equal(tagId, tag.Reference.Id);
        var studio = card.GetCapability(CapabilityRegistry.Studio).Value;
        Assert.NotNull(studio);
        Assert.Equal(studioId, studio.Id);
        Assert.Equal("Obscura Studio", studio.Title);
        var credit = Assert.Single(card.GetCapability(CapabilityRegistry.Credits).Items);
        Assert.Equal(personId, credit.Person.Id);
        Assert.Equal("Ada Person", credit.Person.Title);
        Assert.Equal(EntityCreditRole.Person, credit.Role);
        Assert.Equal("Lead", credit.Character);
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
        Assert.Equal("oshash", fingerprint.Algorithm);
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
    public async Task VideoDetailComposesKindSpecificFieldsWithCapabilities()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        SeedEntity(db, videoId, "video", "Feature");
        db.VideoDetails.Add(new VideoDetailRow
        {
            EntityId = videoId,
            Summary = "A projected video detail.",
            DurationMs = 90_000,
            Width = 1920,
            Height = 1080
        });
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
        Assert.Equal(TimeSpan.FromSeconds(90), detail.Duration);
        Assert.Equal(1920, detail.Width);
        Assert.Equal(1080, detail.Height);
        Assert.Equal(3, detail.GetCapability(CapabilityRegistry.Rating).Value?.Value);
        var marker = Assert.Single(detail.Markers.Items);
        Assert.Equal("Opening", marker.Title);
        Assert.Equal(12.5, marker.Seconds);
        var subtitle = Assert.Single(detail.Subtitles.Items);
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
        SeedEntity(db, episodeId, "video", "Pilot");
        db.EntityRatings.Add(new EntityRatingRow { EntityId = seriesId, Value = 5 });
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = seriesId,
            ChildEntityId = episodeId,
            Relationship = EntityRelationshipRegistry.Episode.Code,
            SortOrder = 1
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var list = await service.ListSeriesAsync(CancellationToken.None);
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
        SeedEntity(db, seasonId, "video-season", "Season 1");
        SeedEntity(db, episodeId, "video", "Episode 1");
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = seriesId,
            ChildEntityId = seasonId,
            Relationship = EntityRelationshipRegistry.Season.Code,
            SortOrder = 1
        });
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = seasonId,
            ChildEntityId = episodeId,
            Relationship = EntityRelationshipRegistry.Episode.Code,
            SortOrder = 1
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
    public async Task HierarchyTreeLoadsOrderedChildrenAndSkipsDeletedEntities()
    {
        await using var db = CreateContext();
        var bookId = Guid.Parse("15151515-1515-1515-1515-151515151515");
        var volumeId = Guid.Parse("16161616-1616-1616-1616-161616161616");
        var chapterId = Guid.Parse("17171717-1717-1717-1717-171717171717");
        var firstPageId = Guid.Parse("18181818-1818-1818-1818-181818181818");
        var deletedPageId = Guid.Parse("19191919-1919-1919-1919-191919191919");
        SeedEntity(db, bookId, "book", "Book Root");
        SeedEntity(db, volumeId, "book-volume", "Volume 1");
        SeedEntity(db, chapterId, "book-chapter", "Chapter 1");
        SeedEntity(db, firstPageId, "book-page", "Page 1");
        db.Entities.Add(new EntityRow
        {
            Id = deletedPageId,
            KindCode = "book-page",
            Title = "Deleted Page",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            DeletedAt = DateTimeOffset.UtcNow
        });
        db.EntityHierarchyLinks.AddRange(
            new EntityHierarchyLinkRow
            {
                ParentEntityId = bookId,
                ChildEntityId = volumeId,
                Relationship = EntityRelationshipRegistry.Volume.Code,
                SortOrder = 1
            },
            new EntityHierarchyLinkRow
            {
                ParentEntityId = volumeId,
                ChildEntityId = chapterId,
                Relationship = EntityRelationshipRegistry.Chapter.Code,
                SortOrder = 1
            },
            new EntityHierarchyLinkRow
            {
                ParentEntityId = chapterId,
                ChildEntityId = deletedPageId,
                Relationship = EntityRelationshipRegistry.Page.Code,
                SortOrder = 1
            },
            new EntityHierarchyLinkRow
            {
                ParentEntityId = chapterId,
                ChildEntityId = firstPageId,
                Relationship = EntityRelationshipRegistry.Page.Code,
                SortOrder = 2
            });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var tree = await service.GetTreeAsync(bookId, EntityHierarchyDefinitions.Book, CancellationToken.None);

        Assert.NotNull(tree);
        Assert.Equal(bookId, tree.Root.Entity.Id);
        var volume = Assert.Single(tree.Root.Children);
        Assert.Equal(EntityRelationshipRegistry.Volume, volume.RelationshipToParent);
        var chapter = Assert.Single(volume.Children);
        Assert.Equal(EntityRelationshipRegistry.Chapter, chapter.RelationshipToParent);
        var page = Assert.Single(chapter.Children);
        Assert.Equal(firstPageId, page.Entity.Id);
        Assert.Equal(2, page.SortOrder);
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
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = collectionId,
            ChildEntityId = imageId,
            Relationship = EntityRelationshipRegistry.CollectionItem.Code,
            SortOrder = 2,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = collectionId,
            ChildEntityId = audioId,
            Relationship = EntityRelationshipRegistry.CollectionItem.Code,
            SortOrder = 3,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityRatings.Add(new EntityRatingRow { EntityId = imageId, Value = 4 });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var children = await service.ListChildrenAsync(
            collectionId,
            EntityRelationshipRegistry.CollectionItem,
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
            EntityId = imageId,
            Details = "Image details",
            Date = "2026-05-12",
            FilePath = "/media/still.jpg",
            FileSizeBytes = 1234,
            Width = 800,
            Height = 600,
            Format = "jpg",
            SortOrder = 7
        });
        db.GalleryDetails.Add(new GalleryDetailRow
        {
            EntityId = galleryId,
            Details = "Gallery details",
            Date = "2026",
            GalleryType = GalleryType.Folder,
            FolderPath = "/media/gallery",
            Photographer = "Photographer",
            ImageCount = 12
        });
        db.BookDetails.Add(new BookDetailRow
        {
            EntityId = bookId,
            BookType = BookType.Comic,
            Summary = "Book summary",
            RelativePath = "books/book",
            PageCount = 42,
            ChapterCount = 3
        });
        db.BookReadProgress.Add(new BookReadProgressRow
        {
            BookEntityId = bookId,
            PageIndex = 5,
            PageCount = 42,
            ReaderMode = ReaderMode.Webtoon,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.AudioLibraryDetails.Add(new AudioLibraryDetailRow
        {
            EntityId = audioLibraryId,
            Details = "Album summary",
            Date = "2026",
            FolderPath = "/media/audio",
            TrackCount = 9
        });
        db.AudioTrackDetails.Add(new AudioTrackDetailRow
        {
            EntityId = audioTrackId,
            Details = "Track summary",
            DurationSeconds = 90,
            Codec = "flac",
            TrackNumber = 2
        });
        db.PersonDetails.Add(new PersonDetailRow
        {
            EntityId = personId,
            Country = "US",
            CareerStart = 2020
        });
        db.StudioDetails.Add(new StudioDetailRow
        {
            EntityId = studioId,
            Description = "Studio description"
        });
        db.TagDetails.Add(new TagDetailRow
        {
            EntityId = tagId,
            Description = "Tag description",
            IgnoreAutoTag = true
        });
        db.CollectionDetails.Add(new CollectionDetailRow
        {
            EntityId = collectionId,
            Description = "Collection description",
            Mode = CollectionMode.Manual,
            ItemCount = 2,
            CoverMode = CollectionCoverMode.Mosaic
        });
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

        Assert.Equal("/media/still.jpg", image?.FilePath);
        Assert.Equal(GalleryType.Folder, gallery?.GalleryType);
        Assert.Equal(BookType.Comic, book?.BookType);
        Assert.Equal(ReaderMode.Webtoon, book?.ReaderMode);
        Assert.Equal(9, audioLibrary?.TrackCount);
        Assert.Equal("flac", audioTrack?.Codec);
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
            EntityId = videoId,
            Summary = "Feature summary",
            OriginalTitle = "Original Feature",
            DurationMs = 1500,
            FrameRate = 23.976,
            Codec = "h264"
        });
        db.VideoSeriesDetails.Add(new VideoSeriesDetailRow
        {
            EntityId = seriesId,
            Overview = "Series overview",
            OriginalTitle = "Original Series",
            RenderingMode = VideoSeriesRenderingMode.Flat
        });
        db.VideoSeasonDetails.Add(new VideoSeasonDetailRow
        {
            EntityId = seasonId,
            SeriesEntityId = seriesId,
            SeasonNumber = 1,
            Overview = "Season overview",
            AirDate = "2026"
        });
        db.BookVolumeDetails.Add(new BookVolumeDetailRow
        {
            EntityId = volumeId,
            BookEntityId = bookId,
            VolumeNumber = 1,
            RelativePath = "books/book/volume-1"
        });
        db.BookChapterDetails.Add(new BookChapterDetailRow
        {
            EntityId = chapterId,
            BookEntityId = bookId,
            VolumeEntityId = volumeId,
            ChapterNumber = 2,
            ArchivePath = "/media/book/chapter.cbz",
            PageCount = 30
        });
        db.BookPageDetails.Add(new BookPageDetailRow
        {
            EntityId = pageId,
            BookEntityId = bookId,
            ChapterEntityId = chapterId,
            FilePath = "/media/book/page-001.jpg",
            Width = 1200,
            Height = 1800,
            SortOrder = 1
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);

        var video = await service.GetVideoAsync(videoId, CancellationToken.None);
        var series = await service.GetSeriesAsync(seriesId, CancellationToken.None);
        var season = await service.GetVideoSeasonAggregateAsync(seasonId, CancellationToken.None);
        var volume = await service.GetBookVolumeAggregateAsync(volumeId, CancellationToken.None);
        var chapter = await service.GetBookChapterAggregateAsync(chapterId, CancellationToken.None);
        var page = await service.GetBookPageAggregateAsync(pageId, CancellationToken.None);

        Assert.Equal("Original Feature", video?.OriginalTitle);
        Assert.Equal(TimeSpan.FromMilliseconds(1500), video?.Duration);
        Assert.Equal("Series overview", series?.Summary);
        Assert.Equal(VideoSeriesRenderingMode.Flat, series?.RenderingMode);
        Assert.Equal(1, season?.SeasonNumber);
        Assert.Equal(1, volume?.VolumeNumber);
        Assert.Equal(30, chapter?.PageCount);
        Assert.Equal("/media/book/page-001.jpg", page?.FilePath);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"entity-projections-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedEntity(ObscuraDbContext db, Guid id, string kind, string title)
    {
        db.Entities.Add(new EntityRow
        {
            Id = id,
            KindCode = kind,
            Title = title,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
