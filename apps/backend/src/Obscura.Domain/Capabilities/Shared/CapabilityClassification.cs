namespace Obscura.Domain.Capabilities;

/// <summary>
/// Classification capability for provider or user-facing ratings and certifications.
/// </summary>
/// <param name="Value">Classification value, such as a content rating or certification.</param>
/// <param name="System">Optional classification system or provider code.</param>
public sealed record CapabilityClassification(string? Value, string? System = null) : ICapability<CapabilityClassification>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityClassification> CapabilityKind { get; } = new CapabilityKind<CapabilityClassification>("classification", "Classification");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty classification capability.</summary>
    public static CapabilityClassification Empty { get; } = new(Value: null);
}
