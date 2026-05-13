namespace Obscura.Domain.Capabilities;

/// <summary>
/// Subtitle capability for entities that expose subtitle or caption tracks.
/// </summary>
/// <param name="Items">Subtitle tracks attached to the entity.</param>
public sealed record CapabilitySubtitles(IReadOnlyList<EntitySubtitle> Items) : ICapability<CapabilitySubtitles>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilitySubtitles> CapabilityKind { get; } = new CapabilityKind<CapabilitySubtitles>("subtitles", "Subtitles");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty subtitle capability.</summary>
    public static CapabilitySubtitles Empty { get; } = new([]);
}
