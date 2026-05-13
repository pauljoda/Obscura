namespace Obscura.Domain.Capabilities;

/// <summary>
/// Description capability for entities that expose synopsis, overview, notes, or details text.
/// </summary>
/// <param name="Value">User-facing description text.</param>
public sealed record CapabilityDescription(string Value) : ICapability<CapabilityDescription>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityDescription> CapabilityKind { get; } = new CapabilityKind<CapabilityDescription>("description", "Description");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty description capability.</summary>
    public static CapabilityDescription Empty { get; } = new(string.Empty);
}
