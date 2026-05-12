namespace Obscura.Domain.Capabilities;

/// <summary>
/// Tag capability for an entity that supports shared tag names.
/// </summary>
/// <param name="Values">Sorted tag names attached to the entity.</param>
public sealed record CapabilityTags(IReadOnlyList<string> Values) : ICapability<CapabilityTags>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityTags> CapabilityKind { get; } = new CapabilityKind<CapabilityTags>("tags", "Tags");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty tag capability.</summary>
    public static CapabilityTags Empty { get; } = new([]);
}
