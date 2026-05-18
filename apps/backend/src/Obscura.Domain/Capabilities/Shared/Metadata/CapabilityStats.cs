namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable statistics capability for stored or derived inventory counts.
/// </summary>
public sealed class CapabilityStats : EntityCapability {
    public CapabilityStats(IReadOnlyList<EntityStat>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Stats;
    public IReadOnlyList<EntityStat> Items { get; private set; }
}
