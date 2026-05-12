using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a playable audio track.
/// </summary>
public sealed record AudioTrack(
    Entity Entity,
    AudioTrackDetails Details)
{
    /// <summary>
    /// Returns a copy of the audio track with updated technical or descriptive details.
    /// </summary>
    public AudioTrack WithDetails(AudioTrackDetails details) => this with { Details = details };

    /// <summary>
    /// Returns a copy of the audio track after a playback event.
    /// </summary>
    /// <param name="resumeTime">Playback position where the next session should resume.</param>
    /// <param name="playedAt">Timestamp of the playback event.</param>
    /// <returns>A new audio track with incremented playback state.</returns>
    public AudioTrack MarkPlayed(TimeSpan resumeTime, DateTimeOffset playedAt)
    {
        var playback = Entity.TryGetCapability(CapabilityRegistry.Playback, out var existing)
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
            Entity = Entity.WithCapability(
                CapabilityRegistry.Playback,
                new CapabilityPlayback(next))
        };
    }
}

/// <summary>
/// Audio-track-specific metadata and technical probe fields.
/// </summary>
public sealed record AudioTrackDetails(
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
{
    /// <summary>
    /// Empty audio details used before scan or probe data is attached.
    /// </summary>
    public static AudioTrackDetails Empty { get; } = new(null, null, null, null, null, null, null, null, null, null, null, null);
}
