using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Domain.Entities;
using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Tests;

public sealed class TypedEntityModelTests
{
    [Theory]
    [InlineData(typeof(AudioLibrary))]
    [InlineData(typeof(AudioTrack))]
    [InlineData(typeof(Book))]
    [InlineData(typeof(Gallery))]
    [InlineData(typeof(Image))]
    [InlineData(typeof(Person))]
    [InlineData(typeof(Studio))]
    [InlineData(typeof(Tag))]
    public void TypedEntityExtensionsComposeTheSharedEntityRoot(Type aggregateType)
    {
        Assert.False(typeof(Entity).IsAssignableFrom(aggregateType));
        Assert.NotNull(aggregateType.GetProperty("Entity"));
    }

    [Fact]
    public void PersonOwnsPersonSpecificDetailsAndMutators()
    {
        var root = new Entity(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            EntityKindRegistry.Person,
            "Ada Person",
            null,
            []);
        var person = new Person(
            root,
            PersonDetails.Empty);

        var updated = person.WithDetails(person.Details with { Country = "US", CareerStart = 2020 });

        Assert.Equal("person", updated.Entity.Kind.Code);
        Assert.Equal("US", updated.Details.Country);
        Assert.Equal(2020, updated.Details.CareerStart);
    }

    [Fact]
    public void AudioTrackOwnsPlaybackAwareAudioDetails()
    {
        var root = new Entity(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            EntityKindRegistry.AudioTrack,
            "Main Theme",
            null,
            [CapabilityPlayback.Empty]);
        var track = new AudioTrack(
            root,
            AudioTrackDetails.Empty with { Duration = TimeSpan.FromSeconds(90), Codec = "flac" });

        var played = track.MarkPlayed(TimeSpan.FromSeconds(45), DateTimeOffset.Parse("2026-05-12T12:00:00Z"));

        Assert.Equal("audio-track", played.Entity.Kind.Code);
        Assert.Equal("flac", played.Details.Codec);
        var playback = played.Entity.GetCapability(CapabilityRegistry.Playback);
        Assert.Equal(1, playback.Value.PlayCount);
        Assert.Equal(TimeSpan.FromSeconds(45), playback.Value.ResumeTime);
    }
}
