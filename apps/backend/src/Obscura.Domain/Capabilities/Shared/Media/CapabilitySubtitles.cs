namespace Obscura.Domain.Capabilities;

/// <summary>Mutable subtitle capability for subtitle or caption tracks.</summary>
public sealed class CapabilitySubtitles(IReadOnlyList<EntitySubtitle>? items = null)
    : ItemsCapability<EntitySubtitle>(items) {
    public override CapabilityKind Kind => CapabilityKind.Subtitles;
}
