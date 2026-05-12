using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Studio capability for an entity that supports a primary studio or publisher reference.
/// </summary>
/// <param name="Value">Primary studio or publisher-like taxonomy entity, or null when none is projected.</param>
public sealed record CapabilityStudio(EntityReference? Value) : ICapability
{
    public ICapabilityKind Kind => Obscura.Domain.Entities.Capabilities.Studio;
}
