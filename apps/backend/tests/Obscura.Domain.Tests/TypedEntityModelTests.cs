using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Domain.Entities;
using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Tests;

public sealed class TypedEntityModelTests
{
    [Theory]
    [InlineData(typeof(Video))]
    [InlineData(typeof(VideoSeries))]
    [InlineData(typeof(VideoSeason))]
    [InlineData(typeof(AudioLibrary))]
    [InlineData(typeof(AudioTrack))]
    [InlineData(typeof(Book))]
    [InlineData(typeof(BookVolume))]
    [InlineData(typeof(BookChapter))]
    [InlineData(typeof(BookPage))]
    [InlineData(typeof(Collection))]
    [InlineData(typeof(Gallery))]
    [InlineData(typeof(Image))]
    [InlineData(typeof(Person))]
    [InlineData(typeof(Studio))]
    [InlineData(typeof(Tag))]
    public void TypedEntityExtensionsInheritTheSharedEntityRoot(Type aggregateType)
    {
        Assert.True(typeof(Entity).IsAssignableFrom(aggregateType));
        Assert.Null(aggregateType.GetProperty("Entity"));
        Assert.Null(aggregateType.GetProperty("Details"));
    }

    [Fact]
    public void GalleryDoesNotExposeLegacyPhotographerMetadata()
    {
        Assert.Null(typeof(Gallery).GetProperty("Photographer"));
    }

    [Fact]
    public void PersonOwnsPersonSpecificDetailsAndMutators()
    {
        var person = new Person(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "Ada Person",
            Disambiguation: null,
            Gender: null,
            Birthdate: null,
            Country: null,
            Ethnicity: null,
            EyeColor: null,
            HairColor: null,
            Height: null,
            Weight: null,
            Measurements: null,
            Tattoos: null,
            Piercings: null,
            CareerStart: null,
            CareerEnd: null,
            capabilities: [new CapabilityDescription("Profile")]);

        var updated = person with { Country = "US", CareerStart = 2020 };

        Assert.Equal("person", updated.Kind.Code);
        Assert.Equal("US", updated.Country);
        Assert.Equal(2020, updated.CareerStart);
    }

    [Fact]
    public void AudioTrackOwnsPlaybackAwareAudioDetails()
    {
        var track = new AudioTrack(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "Main Theme",
            EmbeddedArtist: null,
            EmbeddedAlbum: null,
            capabilities:
            [
                CapabilityPlayback.Empty,
                new CapabilityTechnical(Duration: TimeSpan.FromSeconds(90), Codec: "flac")
            ]);

        var played = track.MarkPlayed(TimeSpan.FromSeconds(45), DateTimeOffset.Parse("2026-05-12T12:00:00Z"));

        Assert.Equal("audio-track", played.Kind.Code);
        Assert.Equal("flac", played.Technical?.Codec);
        var playback = played.GetCapability(CapabilityRegistry.Playback);
        Assert.Equal(1, playback.Value.PlayCount);
        Assert.Equal(TimeSpan.FromSeconds(45), playback.Value.ResumeTime);
    }

    [Fact]
    public void VideoSubtypeExposesSpecificFieldsDirectly()
    {
        var video = new Video(
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "Feature",
            SubtitlesExtractedAt: null,
            capabilities:
            [
                new CapabilityDescription("Direct description"),
                new CapabilityTechnical(Duration: TimeSpan.FromMinutes(2), Width: 1920, Height: 1080),
                new CapabilityClassification("PG"),
                CapabilityPlayback.Empty,
                CapabilityMarkers.Empty,
                CapabilitySubtitles.Empty
            ]);

        Entity entity = video;

        Assert.Equal(video.Id, entity.Id);
        Assert.Equal("video", entity.Kind.Code);
        Assert.Equal("Direct description", video.Description);
        Assert.Equal(TimeSpan.FromMinutes(2), video.Technical?.Duration);
        Assert.Equal("PG", video.Classification?.Value);
        Assert.Null(typeof(Video).GetProperty("Details"));
        Assert.Null(typeof(Video).GetProperty("Summary"));
        Assert.Null(typeof(Video).GetProperty("OriginalTitle"));
        Assert.True(video.HasCapability(CapabilityRegistry.Playback));
    }
}
