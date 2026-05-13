using Obscura.Domain.Entities;
using Obscura.Domain.Capabilities;
using CapabilityRating = Obscura.Domain.Capabilities.CapabilityRating;
using CapabilityTags = Obscura.Domain.Capabilities.CapabilityTags;
using Rating = Obscura.Domain.Capabilities.Rating;

namespace Obscura.Domain.Tests;

public sealed class EntityCapabilityTests
{
    [Fact]
    public void EntityCapabilityHelpersReturnTypedCapabilitiesByKind()
    {
        var tagId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var personId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        var entity = new Entity(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            EntityKindRegistry.Video,
            "Projected Video",
            null,
            [
                new CapabilityRating(new Rating(4)),
                new CapabilityTags([
                    new EntityTag(new EntityReference(tagId, EntityKindRegistry.Tag, "Favorite"))
                ]),
                new CapabilityCredits([
                    new EntityCredit(
                        new EntityReference(personId, EntityKindRegistry.Person, "Ada Person"),
                        EntityCreditRole.Person,
                        "Lead")
                ])
            ]);

        Assert.True(entity.HasCapability(CapabilityRegistry.Rating));
        var rating = entity.GetCapability(CapabilityRegistry.Rating);

        Assert.IsType<CapabilityRating>(rating);
        Assert.Equal(4, rating.Value?.Value);
        var tag = Assert.Single(entity.GetCapability(CapabilityRegistry.Tags).Items);
        Assert.Equal(tagId, tag.Reference.Id);
        var credit = Assert.Single(entity.GetCapability(CapabilityRegistry.Credits).Items);
        Assert.Equal(EntityCreditRole.Person, credit.Role);
        Assert.Equal("Lead", credit.Character);
    }

    [Fact]
    public void EntityRejectsDuplicateCapabilityKinds()
    {
        var ex = Assert.Throws<ArgumentException>(() => new Entity(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            EntityKindRegistry.Video,
            "Projected Video",
            null,
            [
                new CapabilityTags(["One"]),
                new CapabilityTags(["Two"])
            ]));

        Assert.Contains("tags", ex.Message);
    }

    [Fact]
    public void MissingCapabilityHelpersExposeOptionalAndRequiredPaths()
    {
        var entity = new Entity(
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            EntityKindRegistry.Video,
            "Projected Video",
            null,
            [CapabilityTags.Empty]);

        Assert.False(entity.HasCapability(CapabilityRegistry.Rating));
        Assert.False(entity.TryGetCapability(CapabilityRegistry.Rating, out var rating));
        Assert.Null(rating);
        Assert.Throws<InvalidOperationException>(() => entity.GetCapability(CapabilityRegistry.Rating));
    }

    [Fact]
    public void EntityConvenienceAccessorsExposeSharedCapabilities()
    {
        var entity = new Entity(
            Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            EntityKindRegistry.Video,
            "Projected Video",
            null,
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
}
