namespace Obscura.Domain.Capabilities;

/// <summary>Mutable counter capability for named integer event counts.</summary>
public sealed class CapabilityCounters(IReadOnlyList<EntityCounter>? items = null)
    : ItemsCapability<EntityCounter>(items) {
    public override CapabilityKind Kind => CapabilityKind.Counters;
}
