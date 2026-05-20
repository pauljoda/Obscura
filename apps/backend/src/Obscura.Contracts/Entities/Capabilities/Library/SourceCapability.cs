using EntitySource = Obscura.Domain.Capabilities.CapabilitySource.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing source provenance capability.</summary>
[CapabilityKind("source")]
public sealed record SourceCapability(IReadOnlyList<EntitySource> Items) : EntityCapability;
