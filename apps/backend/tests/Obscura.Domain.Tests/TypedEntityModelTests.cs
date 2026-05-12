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
    public void PersonOwnsPersonSpecificDetailsAndMutators()
    {
        var person = new Person(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "Ada Person",
            null,
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
            Description: null);

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
            null,
            Summary: null,
            Date: null,
            Duration: TimeSpan.FromSeconds(90),
            BitRate: null,
            SampleRate: null,
            Channels: null,
            Codec: "flac",
            Container: null,
            EmbeddedArtist: null,
            EmbeddedAlbum: null,
            TrackNumber: null,
            WaveformPath: null);

        var played = track.MarkPlayed(TimeSpan.FromSeconds(45), DateTimeOffset.Parse("2026-05-12T12:00:00Z"));

        Assert.Equal("audio-track", played.Kind.Code);
        Assert.Equal("flac", played.Codec);
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
            null,
            Summary: "Direct summary",
            SortTitle: "Feature",
            OriginalTitle: "Original Feature",
            Tagline: "A tiny test.",
            ReleaseDate: "2026-05-12",
            ContentRating: "PG",
            Duration: TimeSpan.FromMinutes(2),
            Width: 1920,
            Height: 1080,
            FrameRate: 23.976,
            BitRate: 8_000,
            Codec: "h264",
            Container: "mkv",
            LibraryRootId: null,
            SubtitlesExtractedAt: null,
            Markers: Markers.Empty,
            Subtitles: Subtitles.Empty);

        Entity entity = video;

        Assert.Equal(video.Id, entity.Id);
        Assert.Equal("video", entity.Kind.Code);
        Assert.Equal("Direct summary", video.Summary);
        Assert.Equal("Original Feature", video.OriginalTitle);
        Assert.Equal(TimeSpan.FromMinutes(2), video.Duration);
        Assert.Null(typeof(Video).GetProperty("Details"));
        Assert.True(video.HasCapability(CapabilityRegistry.Playback));
    }
}
