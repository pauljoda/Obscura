using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Entities;
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
        var performerId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        SeedEntity(db, videoId, "video", "A Quiet Scene");
        SeedEntity(db, tagId, "tag", "Favorite");
        SeedEntity(db, studioId, "studio", "Obscura Studio");
        SeedEntity(db, performerId, "performer", "Ada Actor");
        db.EntityRatings.Add(new EntityRatingRow { EntityId = videoId, Value = 4 });
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
            PersonEntityId = performerId,
            Role = "performer",
            Character = "Lead",
            SortOrder = 1,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
            EntityId = videoId,
            Role = "thumbnail",
            Path = "/assets/videos/11111111-1111-1111-1111-111111111111/card",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var response = await service.ListVideosAsync(CancellationToken.None);

        var card = Assert.Single(response.Items);
        Assert.Equal(videoId, card.Id);
        Assert.Equal("video", card.Kind);
        Assert.Equal(4, card.Capabilities.Rating?.Value);
        Assert.Equal(["Favorite"], card.Capabilities.Tags);
        Assert.Equal(studioId, card.Capabilities.Studio?.Id);
        Assert.Equal("Obscura Studio", card.Capabilities.Studio?.Title);
        var credit = Assert.Single(card.Capabilities.Credits);
        Assert.Equal(performerId, credit.Id);
        Assert.Equal("Ada Actor", credit.Title);
        Assert.Equal("/assets/videos/11111111-1111-1111-1111-111111111111/card", card.Capabilities.ThumbnailUrl);
        Assert.True(card.Capabilities.IsFavorite);
        Assert.False(card.Capabilities.IsNsfw);
        Assert.True(card.Capabilities.IsOrganized);
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
            new RatingUpdateRequestDto(5),
            CancellationToken.None);
        var cleared = await service.UpdateRatingAsync(
            imageId,
            new RatingUpdateRequestDto(null),
            CancellationToken.None);

        Assert.Equal(5, rated?.Capabilities.Rating?.Value);
        Assert.Null(cleared?.Capabilities.Rating);
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
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var detail = await service.GetVideoAsync(videoId, CancellationToken.None);

        Assert.NotNull(detail);
        Assert.Equal("Feature", detail.Title);
        Assert.Equal(TimeSpan.FromSeconds(90), detail.Duration);
        Assert.Equal(1920, detail.Width);
        Assert.Equal(1080, detail.Height);
        Assert.Equal(3, detail.Capabilities.Rating?.Value);
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
            Relationship = "episode",
            SortOrder = 1
        });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var list = await service.ListSeriesAsync(CancellationToken.None);
        var detail = await service.GetSeriesAsync(seriesId, CancellationToken.None);

        var card = Assert.Single(list.Items);
        Assert.Equal(seriesId, card.Id);
        Assert.Equal("video-series", card.Kind);
        Assert.Equal(5, card.Capabilities.Rating?.Value);
        Assert.NotNull(detail);
        Assert.Equal("Collected Episodes", detail.Title);
        Assert.Equal("seasons", detail.RenderingMode);
        Assert.Empty(detail.Children);
        var video = Assert.Single(detail.Videos);
        Assert.Equal(episodeId, video.Id);
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
