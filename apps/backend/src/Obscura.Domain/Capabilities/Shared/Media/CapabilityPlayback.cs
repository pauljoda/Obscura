namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable playback capability for time-based entities.
/// </summary>
public sealed class CapabilityPlayback : EntityCapability {
    /// <summary>
    /// Creates a playback capability.
    /// </summary>
    /// <param name="value">Initial playback state.</param>
    public CapabilityPlayback(Playback? value = null) {
        Value = value ?? Playback.Empty;
    }

    /// <inheritdoc />
    public override CapabilityKind Kind => CapabilityKind.Playback;

    /// <summary>Single-user playback state.</summary>
    public Playback Value { get; private set; }

    /// <summary>
    /// Records a playback event.
    /// </summary>
    /// <param name="resumeTime">Position where the next session should resume.</param>
    /// <param name="playedAt">Timestamp of the playback event.</param>
    public void MarkPlayed(TimeSpan resumeTime, DateTimeOffset playedAt) {
        Value = Value with {
            PlayCount = Value.PlayCount + 1,
            ResumeTime = resumeTime < TimeSpan.Zero ? TimeSpan.Zero : resumeTime,
            LastPlayedAt = playedAt,
            CompletedAt = null
        };
    }
}
