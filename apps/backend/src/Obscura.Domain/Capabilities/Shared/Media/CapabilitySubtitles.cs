namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable subtitle capability for subtitle or caption tracks.
/// </summary>
public sealed class CapabilitySubtitles : EntityCapability {
    public CapabilitySubtitles(IReadOnlyList<EntitySubtitle>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Subtitles;
    public IReadOnlyList<EntitySubtitle> Items { get; private set; }
}
