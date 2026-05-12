namespace Obscura.Domain.Capabilities;

/// <summary>
/// Single-user playback state that can be shared by time-based media entities.
/// </summary>
/// <param name="PlayCount">Number of completed or started play sessions recorded for the entity.</param>
/// <param name="PlayDuration">Total accumulated playback duration.</param>
/// <param name="ResumeTime">Position where playback should resume.</param>
/// <param name="LastPlayedAt">Timestamp of the most recent playback event.</param>
/// <param name="CompletedAt">Timestamp when the entity was completed, when applicable.</param>
public sealed record Playback(
    int PlayCount,
    TimeSpan PlayDuration,
    TimeSpan ResumeTime,
    DateTimeOffset? LastPlayedAt,
    DateTimeOffset? CompletedAt)
{
    /// <summary>
    /// Empty playback state for media that has never been played.
    /// </summary>
    public static Playback Empty { get; } = new(0, TimeSpan.Zero, TimeSpan.Zero, null, null);
}
