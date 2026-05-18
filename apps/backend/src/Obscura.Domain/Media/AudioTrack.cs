using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a playable audio track.
/// </summary>
public sealed class AudioTrack : Entity {
    public AudioTrack(
        Guid id,
        string title,
        string? embeddedArtist,
        string? embeddedAlbum,
        IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? DefaultCapabilities()) {
        EmbeddedArtist = embeddedArtist;
        EmbeddedAlbum = embeddedAlbum;
    }

    public override EntityKind Kind => EntityKind.AudioTrack;
    public string? EmbeddedArtist { get; private set; }
    public string? EmbeddedAlbum { get; private set; }

    /// <summary>
    /// Records a playback event on the attached playback capability.
    /// </summary>
    public void MarkPlayed(TimeSpan resumeTime, DateTimeOffset playedAt) {
        var playback = GetCapability<CapabilityPlayback>();
        if (playback is null) {
            playback = new CapabilityPlayback();
            AddCapability(playback);
        }

        playback.MarkPlayed(resumeTime, playedAt);
    }

    private static IEnumerable<EntityCapability> DefaultCapabilities() =>
    [
        new CapabilityRating(),
        new CapabilityImages(),
        new CapabilityLinks(),
        new CapabilityFlags(),
        new CapabilityFiles(),
        new CapabilityPlayback()
    ];
}
