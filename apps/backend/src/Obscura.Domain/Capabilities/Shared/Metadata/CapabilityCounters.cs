namespace Obscura.Domain.Capabilities;

/// <summary>
/// Counter capability for entities that track named integer event counts.
/// </summary>
/// <param name="Items">Named counters attached to the entity.</param>
public sealed record CapabilityCounters(IReadOnlyList<EntityCounter> Items) : ICapability<CapabilityCounters>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityCounters> CapabilityKind { get; } = new CapabilityKind<CapabilityCounters>("counters", "Counters");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty counter capability.</summary>
    public static CapabilityCounters Empty { get; } = new([]);
}
