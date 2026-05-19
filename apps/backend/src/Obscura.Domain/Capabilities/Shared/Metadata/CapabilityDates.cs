namespace Obscura.Domain.Capabilities;

/// <summary>Mutable date capability for named provider or user-facing dates.</summary>
public sealed class CapabilityDates(IReadOnlyList<EntityDate>? items = null)
    : ItemsCapability<EntityDate>(items);
