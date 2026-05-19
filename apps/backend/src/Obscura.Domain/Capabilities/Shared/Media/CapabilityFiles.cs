namespace Obscura.Domain.Capabilities;

/// <summary>Mutable file capability for attached source, generated, or cached files.</summary>
public sealed class CapabilityFiles(IReadOnlyList<EntityFile>? items = null)
    : ItemsCapability<EntityFile>(items) {
    public override CapabilityKind Kind => CapabilityKind.Files;
}
