namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable position capability for structural ordering and numbered media members.
/// </summary>
public sealed class CapabilityPosition : EntityCapability {
    public CapabilityPosition(IReadOnlyList<EntityPosition>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Position;
    public IReadOnlyList<EntityPosition> Items { get; private set; }
}
