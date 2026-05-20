using EntityMarker = Obscura.Domain.Capabilities.CapabilityMarkers.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing marker capability.</summary>
[CapabilityKind("markers")]
public sealed record MarkersCapability(IReadOnlyList<EntityMarker> Items) : EntityCapability;
