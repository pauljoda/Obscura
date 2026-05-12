using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Studio capability for an entity that supports a primary studio or publisher reference.
/// </summary>
/// <param name="Value">Primary studio or publisher-like taxonomy entity, or null when none is projected.</param>
public sealed record CapabilityStudio(EntityReference? Value) : ICapability<CapabilityStudio>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityStudio> CapabilityKind { get; } = new CapabilityKind<CapabilityStudio>("studio", "Studio");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;
}
