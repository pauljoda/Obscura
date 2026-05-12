namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for shared artwork URLs.</summary>
public sealed class ImagesCapabilityKind()
    : CapabilityKind<CapabilityImages>("images", "Images")
{
}
