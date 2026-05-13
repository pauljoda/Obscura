using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a playable audio track.
/// </summary>
public sealed record AudioTrack : Entity
{
    /// <summary>
    /// Creates an audio track with explicit shared capabilities and source tag metadata.
    /// </summary>
    public AudioTrack(
        Guid Id,
        string Title,
        string? EmbeddedArtist,
        string? EmbeddedAlbum,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.AudioTrack,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityCredits.Empty,
                new CapabilityStudio(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty,
                CapabilityPlayback.Empty
            ])
    {
        this.EmbeddedArtist = EmbeddedArtist;
        this.EmbeddedAlbum = EmbeddedAlbum;
    }

    /// <summary>Artist value read from embedded audio tags, when known.</summary>
    public string? EmbeddedArtist { get; init; }

    /// <summary>Album value read from embedded audio tags, when known.</summary>
    public string? EmbeddedAlbum { get; init; }

    /// <summary>
    /// Creates an audio track from an already hydrated entity root.
    /// </summary>
    public AudioTrack(Entity entity, string? embeddedArtist, string? embeddedAlbum)
        : this(entity.Id, entity.Title, embeddedArtist, embeddedAlbum, entity.Capabilities)
    {
    }

    /// <summary>
    /// Returns a copy of the audio track after a playback event.
    /// </summary>
    /// <param name="resumeTime">Playback position where the next session should resume.</param>
    /// <param name="playedAt">Timestamp of the playback event.</param>
    /// <returns>A new audio track with incremented playback state.</returns>
    public AudioTrack MarkPlayed(TimeSpan resumeTime, DateTimeOffset playedAt)
    {
        var playback = TryGetCapability(CapabilityRegistry.Playback, out var existing)
            ? existing.Value
            : Playback.Empty;
        var next = playback with
        {
            PlayCount = playback.PlayCount + 1,
            ResumeTime = resumeTime < TimeSpan.Zero ? TimeSpan.Zero : resumeTime,
            LastPlayedAt = playedAt,
            CompletedAt = null
        };

        return this with
        {
            Capabilities = WithCapability(
                CapabilityRegistry.Playback,
                new CapabilityPlayback(next)).Capabilities
        };
    }
}
