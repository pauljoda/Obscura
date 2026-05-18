namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable source capability for library, file, and import provenance values.
/// </summary>
public sealed class CapabilitySource : EntityCapability {
    public CapabilitySource(IReadOnlyList<EntitySource>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Source;
    public IReadOnlyList<EntitySource> Items { get; private set; }
}
