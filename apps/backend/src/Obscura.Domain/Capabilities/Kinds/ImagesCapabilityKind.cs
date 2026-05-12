namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for shared artwork URLs.</summary>
public sealed record ImagesCapabilityKind()
    : ICapabilityKind<CapabilityImages>
{
    public string Code => "images";
    public string DisplayName => "Images";
    public Type CapabilityType => typeof(CapabilityImages);
}
