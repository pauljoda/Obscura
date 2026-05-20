using EntityDate = Obscura.Domain.Capabilities.EntityDate;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing named date capability.</summary>
[CapabilityKind("dates")]
public sealed record DatesCapability(IReadOnlyList<EntityDate> Items) : EntityCapability;
