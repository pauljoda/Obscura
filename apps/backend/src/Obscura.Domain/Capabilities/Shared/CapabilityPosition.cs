namespace Obscura.Domain.Capabilities;

/// <summary>
/// Position capability for structural ordering and numbered media members.
/// </summary>
/// <param name="Items">Named position values attached to the entity.</param>
public sealed record CapabilityPosition(IReadOnlyList<EntityPosition> Items) : ICapability<CapabilityPosition>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityPosition> CapabilityKind { get; } = new CapabilityKind<CapabilityPosition>("position", "Position");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty position capability.</summary>
    public static CapabilityPosition Empty { get; } = new([]);
}
