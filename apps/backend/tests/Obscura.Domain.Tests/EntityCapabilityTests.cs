using Obscura.Domain.Entities;
using CapabilityRating = Obscura.Domain.Capabilities.CapabilityRating;
using CapabilityTags = Obscura.Domain.Capabilities.CapabilityTags;
using CapabilityKinds = Obscura.Domain.Entities.Capabilities;
using Rating = Obscura.Domain.Capabilities.Rating;
using RatingValue = Obscura.Domain.Capabilities.RatingValue;

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
            null,
            [
                new CapabilityRating(new Rating(RatingValue.Create(4))),
                new CapabilityTags(["Favorite"])
            ]);

        Assert.True(entity.HasCapability(CapabilityKinds.Rating));
        var rating = entity.GetCapability(CapabilityKinds.Rating);

        Assert.IsType<CapabilityRating>(rating);
        Assert.Equal(4, rating.Value?.Value.Value);
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
            [new CapabilityTags([])]);

        Assert.False(entity.HasCapability(CapabilityKinds.Rating));
        Assert.False(entity.TryGetCapability(CapabilityKinds.Rating, out var rating));
        Assert.Null(rating);
        Assert.Throws<InvalidOperationException>(() => entity.GetCapability(CapabilityKinds.Rating));
    }
}
