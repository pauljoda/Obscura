namespace Obscura.Domain.Capabilities;

/// <summary>Mutable position capability for structural ordering and numbered media members.</summary>
public sealed class CapabilityPosition(IReadOnlyList<EntityPosition>? items = null)
    : ItemsCapability<EntityPosition>(items);
