using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;

namespace Obscura.Domain.Tests;

public sealed class EntityCapabilityTests {
    [Fact]
    public void GetCapabilityReturnsAttachedReference() {
        var rating = new CapabilityRating();
        var video = new Video(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "Projected Video",
            subtitlesExtractedAt: null,
            capabilities: [rating]);

        var attached = video.GetCapability<CapabilityRating>();

        Assert.Same(rating, attached);
        Assert.Same(video, attached!.Entity);
    }

    [Fact]
    public void MutatingReturnedCapabilityMutatesEntityState() {
        var video = new Video(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "Projected Video",
            subtitlesExtractedAt: null,
            capabilities: [new CapabilityRating()]);

        video.GetCapability<CapabilityRating>()!.Rate(4);

        Assert.Equal(4, video.GetCapability<CapabilityRating>()!.Value);
        Assert.Equal(4, video.Rating!.Value);
    }

    [Fact]
    public void EntityRejectsDuplicateCapabilityKinds() {
        var ex = Assert.Throws<ArgumentException>(() => new Video(
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "Projected Video",
            subtitlesExtractedAt: null,
            capabilities: [new CapabilityRating(1), new CapabilityRating(2)]));

        Assert.Contains(nameof(CapabilityKind.Rating), ex.Message);
    }

    [Fact]
    public void MissingCapabilityHelpersExposeOptionalAndRequiredPaths() {
        var image = new Image(
            Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            "Projected Image",
            capabilities: []);

        Assert.False(image.HasCapability<CapabilityRating>());
        Assert.Null(image.GetCapability<CapabilityRating>());
        Assert.Throws<InvalidOperationException>(() => image.RequireCapability<CapabilityRating>());
    }

    [Fact]
    public void RemoveCapabilityDetachesTheCapabilityFromTheEntity() {
        var rating = new CapabilityRating(5);
        var image = new Image(
            Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            "Projected Image",
            capabilities: [rating]);

        var removed = image.RemoveCapability<CapabilityRating>();

        Assert.True(removed);
        Assert.Null(image.GetCapability<CapabilityRating>());
        Assert.Null(rating.Entity);
    }

    [Fact]
    public void EntityChildrenCanBeAddedAndReturnedByConcreteType() {
        var season = new VideoSeason(
            Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            "Season 1",
            parentEntityId: null);
        var episode = new Video(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "Episode 1",
            subtitlesExtractedAt: null);
        var series = new VideoSeries(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "Series");

        series.AddChild(season);
        series.AddChild(episode);

        Assert.Same(season, Assert.Single(series.ChildrenOf<VideoSeason>()));
        Assert.Same(episode, Assert.Single(series.ChildrenOf<Video>()));
        Assert.Equal([season, episode], series.ChildEntities);
    }
}
