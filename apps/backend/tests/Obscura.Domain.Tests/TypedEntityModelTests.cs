using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;

namespace Obscura.Domain.Tests;

public sealed class TypedEntityModelTests
{
    [Fact]
    public void PersonOwnsPersonSpecificDetailsAndMutators()
    {
        var person = new Person(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "Ada Person",
            null,
            [],
            PersonDetails.Empty);

        var updated = person.WithDetails(person.Details with { Country = "US", CareerStart = 2020 });

        Assert.Equal("person", updated.Kind.Code);
        Assert.Equal("US", updated.Details.Country);
        Assert.Equal(2020, updated.Details.CareerStart);
    }

    [Fact]
    public void AudioTrackOwnsPlaybackAwareAudioDetails()
    {
        var track = new AudioTrack(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "Main Theme",
            null,
            [],
            AudioTrackDetails.Empty with { Duration = TimeSpan.FromSeconds(90), Codec = "flac" });

        var played = track.MarkPlayed(TimeSpan.FromSeconds(45), DateTimeOffset.Parse("2026-05-12T12:00:00Z"));

        Assert.Equal("audio-track", played.Kind.Code);
        Assert.Equal("flac", played.Details.Codec);
        Assert.Equal(1, played.Playback.PlayCount);
        Assert.Equal(TimeSpan.FromSeconds(45), played.Playback.ResumeTime);
    }
}
