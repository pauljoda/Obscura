namespace Obscura.Domain.Capabilities;

/// <summary>
/// Source capability for library, file, and import provenance values.
/// </summary>
/// <param name="Items">Named source values attached to the entity.</param>
public sealed record CapabilitySource(IReadOnlyList<EntitySource> Items) : ICapability<CapabilitySource>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilitySource> CapabilityKind { get; } = new CapabilityKind<CapabilitySource>("source", "Source");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty source capability.</summary>
    public static CapabilitySource Empty { get; } = new([]);
}
