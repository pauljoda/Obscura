namespace Obscura.Domain.Capabilities;

/// <summary>Mutable statistics capability for stored or derived inventory counts.</summary>
public sealed class CapabilityStats(IReadOnlyList<EntityStat>? items = null)
    : ItemsCapability<EntityStat>(items);
