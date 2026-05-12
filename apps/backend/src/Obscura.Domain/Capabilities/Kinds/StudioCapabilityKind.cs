namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for primary studio or publisher references.</summary>
public sealed record StudioCapabilityKind()
    : ICapabilityKind<CapabilityStudio>
{
    public string Code => "studio";
    public string DisplayName => "Studio";
    public Type CapabilityType => typeof(CapabilityStudio);
}
