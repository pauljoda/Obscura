using EntityDate = Obscura.Domain.Capabilities.EntityDate;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing semantic lifetime capability.</summary>
[CapabilityKind("lifetime")]
public sealed record LifetimeCapability(EntityDate? Start, EntityDate? End, string? Label) : EntityCapability;
