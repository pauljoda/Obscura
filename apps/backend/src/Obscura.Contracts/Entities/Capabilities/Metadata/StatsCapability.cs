using EntityStat = Obscura.Domain.Capabilities.CapabilityStats.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing stored or derived statistic capability.</summary>
[CapabilityKind("stats")]
public sealed record StatsCapability(IReadOnlyList<EntityStat> Items) : EntityCapability;
