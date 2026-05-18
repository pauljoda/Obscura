namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable file capability for attached source, generated, or cached files.
/// </summary>
public sealed class CapabilityFiles : EntityCapability {
    public CapabilityFiles(IReadOnlyList<EntityFile>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Files;
    public IReadOnlyList<EntityFile> Items { get; private set; }
}
