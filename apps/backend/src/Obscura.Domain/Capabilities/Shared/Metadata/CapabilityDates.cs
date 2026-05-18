namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable date capability for named provider or user-facing dates.
/// </summary>
public sealed class CapabilityDates : EntityCapability {
    public CapabilityDates(IReadOnlyList<EntityDate>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public override CapabilityKind Kind => CapabilityKind.Dates;
    public IReadOnlyList<EntityDate> Items { get; private set; }
}
