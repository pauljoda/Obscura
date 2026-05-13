namespace Obscura.Domain.Capabilities;

/// <summary>
/// Statistics capability for stored or derived inventory counts.
/// </summary>
/// <param name="Items">Named statistic values attached to the entity.</param>
public sealed record CapabilityStats(IReadOnlyList<EntityStat> Items) : ICapability<CapabilityStats>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityStats> CapabilityKind { get; } = new CapabilityKind<CapabilityStats>("stats", "Stats");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty stats capability.</summary>
    public static CapabilityStats Empty { get; } = new([]);
}
