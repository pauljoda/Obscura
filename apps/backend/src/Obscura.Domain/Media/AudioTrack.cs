using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a playable audio track.
/// </summary>
public sealed record AudioTrack(
    Guid Id,
    string Title,
    string? Subtitle,
    string? Summary,
    string? Date,
    TimeSpan? Duration,
    int? BitRate,
    int? SampleRate,
    int? Channels,
    string? Codec,
    string? Container,
    string? EmbeddedArtist,
    string? EmbeddedAlbum,
    int? TrackNumber,
    string? WaveformPath)
    : Entity(
        Id,
        EntityKindRegistry.AudioTrack,
        Title,
        Subtitle,
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
    /// <summary>
    /// Creates an audio track from an already hydrated entity root.
    /// </summary>
    public AudioTrack(
        Entity entity,
        string? Summary,
        string? Date,
        TimeSpan? Duration,
        int? BitRate,
        int? SampleRate,
        int? Channels,
        string? Codec,
        string? Container,
        string? EmbeddedArtist,
        string? EmbeddedAlbum,
        int? TrackNumber,
        string? WaveformPath)
        : this(
            entity.Id,
            entity.Title,
            entity.Subtitle,
            Summary,
            Date,
            Duration,
            BitRate,
            SampleRate,
            Channels,
            Codec,
            Container,
            EmbeddedArtist,
            EmbeddedAlbum,
            TrackNumber,
            WaveformPath)
    {
        Capabilities = entity.Capabilities;
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
