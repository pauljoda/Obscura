namespace Obscura.Domain.Capabilities;

/// <summary>
/// Date capability for named provider or user-facing dates.
/// </summary>
/// <param name="Items">Named date values attached to the entity.</param>
public sealed record CapabilityDates(IReadOnlyList<EntityDate> Items) : ICapability<CapabilityDates>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityDates> CapabilityKind { get; } = new CapabilityKind<CapabilityDates>("dates", "Dates");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty dates capability.</summary>
    public static CapabilityDates Empty { get; } = new([]);
}
