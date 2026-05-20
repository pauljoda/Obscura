using EntityPosition = Obscura.Domain.Capabilities.CapabilityPosition.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing structural position capability.</summary>
[CapabilityKind("position")]
public sealed record PositionCapability(IReadOnlyList<EntityPosition> Items) : EntityCapability;
