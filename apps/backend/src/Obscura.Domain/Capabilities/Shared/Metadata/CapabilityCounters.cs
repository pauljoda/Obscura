namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable counter capability for named integer event counts.
/// </summary>
public sealed class CapabilityCounters : EntityCapability {
    public CapabilityCounters(IReadOnlyList<EntityCounter>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Counters;
    public IReadOnlyList<EntityCounter> Items { get; private set; }
}
