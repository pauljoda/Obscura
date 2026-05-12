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
        SeedEntity(db, videoId, "video", "A Quiet Scene");
        SeedEntity(db, tagId, "tag", "Favorite");
        db.EntityRatings.Add(new EntityRatingRow { EntityId = videoId, Value = 4 });
        db.EntityFlags.Add(new EntityFlagRow
        {
            EntityId = videoId,
            IsFavorite = true,
            IsNsfw = false,
            IsOrganized = true
        });
        db.EntityTagLinks.Add(new EntityTagLinkRow { EntityId = videoId, TagId = tagId });
        await db.SaveChangesAsync();

        var service = new EntityProjectionService(db);
        var response = await service.ListVideosAsync(CancellationToken.None);

        var card = Assert.Single(response.Items);
        Assert.Equal(videoId, card.Id);
        Assert.Equal("video", card.Kind);
        Assert.Equal(4, card.Capabilities.Rating?.Value);
        Assert.Equal(["Favorite"], card.Capabilities.Tags);
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
