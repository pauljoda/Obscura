using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Domain.Capabilities;
using CapabilityRating = Obscura.Domain.Capabilities.CapabilityRating;
using Rating = Obscura.Domain.Capabilities.Rating;

namespace Obscura.Domain.Tests;

public sealed class EntityCapabilityTests
{
    [Fact]
    public void EntityCapabilityHelpersReturnTypedCapabilitiesByKind()
    {
        var entity = new Entity(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            EntityKindRegistry.Video,
            "Projected Video",
            [
                new CapabilityRating(new Rating(4)),
                new CapabilityDescription("A typed capability")
            ]);

        Assert.True(entity.HasCapability(CapabilityRegistry.Rating));
        var rating = entity.GetCapability(CapabilityRegistry.Rating);

        Assert.IsType<CapabilityRating>(rating);
        Assert.Equal(4, rating.Value?.Value);
        Assert.Equal("A typed capability", entity.GetCapability(CapabilityRegistry.Description).Value);
    }

    [Fact]
    public void EntityRejectsDuplicateCapabilityKinds()
    {
        var ex = Assert.Throws<ArgumentException>(() => new Entity(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            EntityKindRegistry.Video,
            "Projected Video",
            [
                new CapabilityRating(new Rating(1)),
                new CapabilityRating(new Rating(2))
            ]));

        Assert.Contains("rating", ex.Message);
    }

    [Fact]
    public void MissingCapabilityHelpersExposeOptionalAndRequiredPaths()
    {
        var entity = new Entity(
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            EntityKindRegistry.Video,
            "Projected Video",
            []);

        Assert.False(entity.HasCapability(CapabilityRegistry.Rating));
        Assert.False(entity.TryGetCapability(CapabilityRegistry.Rating, out var rating));
        Assert.Null(rating);
        Assert.Throws<InvalidOperationException>(() => entity.GetCapability(CapabilityRegistry.Rating));
    }

    [Fact]
    public void EntityRelationshipsExposeReferenceGroupsOutsideCapabilities()
    {
        var personId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var tagId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var relationships = new EntityRelationships([
            new EntityRelationshipGroup(
                "cast",
                EntityKindRegistry.Person,
                "Cast",
                [new EntityRelationshipItem(personId, """{"role":"person","character":"Lead"}""")]),
            new EntityRelationshipGroup(
                "tags",
                EntityKindRegistry.Tag,
                "Tags",
                [new EntityRelationshipItem(tagId, null)])
        ]);
        var entity = new Entity(
            Guid.Parse("66666666-6666-6666-6666-666666666666"),
            EntityKindRegistry.Video,
            "Projected Video",
            [new CapabilityRating(null)],
            relationships: relationships);

        Assert.True(entity.HasCapability(CapabilityRegistry.Rating));
        Assert.DoesNotContain(entity.Capabilities, capability => capability.Kind.Code is "tags" or "credits" or "studio");
        Assert.Equal("cast", entity.Relationships.Groups[0].Code);
        Assert.Equal(personId, entity.Relationships.Groups[0].Items[0].EntityId);
        Assert.Equal(tagId, entity.Relationships.Groups[1].Items[0].EntityId);
    }

    [Fact]
    public void EntityConvenienceAccessorsExposeSharedCapabilities()
    {
        var entity = new Entity(
            Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            EntityKindRegistry.Video,
            "Projected Video",
            [
                new CapabilityDescription("A shared description"),
                new CapabilityImages(
                    [EntityFileRole.Thumbnail],
                    [new EntityImageAsset(EntityFileRole.Thumbnail, "/thumb.jpg", "image/jpeg")],
                    "/thumb.jpg",
                    null),
                new CapabilityStats([new EntityStat("images", 12)]),
                new CapabilityTechnical(Duration: TimeSpan.FromSeconds(90), Width: 1920, Height: 1080),
                new CapabilityClassification("R")
            ]);

        Assert.Equal("A shared description", entity.Description);
        Assert.Equal("/thumb.jpg", entity.Images?.ThumbnailUrl);
        Assert.Equal(12, Assert.Single(entity.Stats!.Items).Value);
        Assert.Equal(1920, entity.Technical?.Width);
        Assert.Equal("R", entity.Classification?.Value);
    }

    [Fact]
    public void EntityChildrenReturnTypedChildrenByKindWithoutStringIndexing()
    {
        var season = new VideoSeason(
            Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            "Season 1",
            Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"));
        var episode = new Video(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "Episode 1",
            null);
        var entity = new Entity(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            EntityKindRegistry.VideoSeries,
            "Series",
            [],
            children: new EntityChildren([
                new EntityChildSet(EntityKindRegistry.VideoSeason, [season]),
                new EntityChildSet(EntityKindRegistry.Video, [episode])
            ]));

        var seasons = entity.ChildrenByKind.Get(EntityKindRegistry.VideoSeason);
        var episodes = entity.ChildrenByKind.Get(EntityKindRegistry.Video);

        Assert.Same(season, Assert.Single(seasons));
        Assert.Same(episode, Assert.Single(episodes));
        Assert.Empty(entity.ChildrenByKind.Get(EntityKindRegistry.Gallery));
    }

    [Fact]
    public void EntityChildrenRejectDuplicateKindGroups()
    {
        var ex = Assert.Throws<ArgumentException>(() => new EntityChildren([
            new EntityChildSet(EntityKindRegistry.Video, []),
            new EntityChildSet(EntityKindRegistry.Video, [])
        ]));

        Assert.Contains(EntityKindRegistry.Video.Code, ex.Message);
    }

    [Fact]
    public void LifetimeCapabilityProvidesTypedSharedDateRange()
    {
        var lifetime = new CapabilityLifetime(
            new EntityDate("first-air", "2020-01-01", new DateOnly(2020, 1, 1), "day"),
            new EntityDate("end-air", "2024", new DateOnly(2024, 1, 1), "year"),
            "Aired");
        var entity = new Entity(
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            EntityKindRegistry.VideoSeries,
            "Series",
            [lifetime]);

        Assert.True(entity.HasCapability(CapabilityRegistry.Lifetime));
        Assert.Same(lifetime, entity.Lifetime);
        Assert.Equal("Aired", entity.GetCapability(CapabilityRegistry.Lifetime).Label);
    }
}
