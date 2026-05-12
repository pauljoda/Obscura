namespace Obscura.Domain.Capabilities;

/// <summary>
/// Playback capability for time-based entities that support resume, completion, and play-count state.
/// </summary>
/// <param name="Value">Single-user playback state attached to the entity.</param>
public sealed record CapabilityPlayback(Playback Value) : ICapability<CapabilityPlayback>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityPlayback> CapabilityKind { get; } = new CapabilityKind<CapabilityPlayback>("playback", "Playback");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty playback capability.</summary>
    public static CapabilityPlayback Empty { get; } = new(Playback.Empty);
}
