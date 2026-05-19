using EntityCounter = Obscura.Domain.Capabilities.EntityCounter;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing counter capability.</summary>
/// <param name="Items">Named counters attached to the entity.</param>
public sealed record CountersCapability(IReadOnlyList<EntityCounter> Items) : EntityCapability;
