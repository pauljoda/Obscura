namespace Obscura.Domain.Capabilities;

/// <summary>
/// Flag capability for an entity that supports shared user-facing boolean state.
/// </summary>
/// <param name="IsFavorite">Whether the entity is marked as a favorite.</param>
/// <param name="IsNsfw">Whether the entity should be treated as adult or hidden in SFW mode.</param>
/// <param name="IsOrganized">Whether the entity has been reviewed and accepted into the organized library.</param>
public sealed record CapabilityFlags(bool? IsFavorite, bool? IsNsfw, bool? IsOrganized) : ICapability<CapabilityFlags>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityFlags> CapabilityKind { get; } = new CapabilityKind<CapabilityFlags>("flags", "Flags");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty flags capability.</summary>
    public static CapabilityFlags Empty { get; } = new(null, null, null);
}
