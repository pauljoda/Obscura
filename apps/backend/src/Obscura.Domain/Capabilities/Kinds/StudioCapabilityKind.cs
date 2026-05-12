namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for primary studio or publisher references.</summary>
public sealed class StudioCapabilityKind()
    : CapabilityKind<CapabilityStudio>("studio", "Studio")
{
}
