namespace Obscura.Domain.Capabilities;

/// <summary>
/// Shared semantic lifetime range for entities that have a meaningful beginning and ending date.
/// </summary>
/// <param name="Start">Semantic start date, such as birth, founding, or first air date.</param>
/// <param name="End">Semantic end date, such as death, closure, or final air date.</param>
/// <param name="Label">Optional display label for the lifetime context.</param>
public sealed record CapabilityLifetime(
    EntityDate? Start,
    EntityDate? End,
    string? Label = null) : ICapability<CapabilityLifetime>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityLifetime> CapabilityKind { get; } = new CapabilityKind<CapabilityLifetime>("lifetime", "Lifetime");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty lifetime capability.</summary>
    public static CapabilityLifetime Empty { get; } = new(null, null);
}
