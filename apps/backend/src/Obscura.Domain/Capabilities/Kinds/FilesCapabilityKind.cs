namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for physical or generated files.</summary>
public sealed class FilesCapabilityKind()
    : CapabilityKind<CapabilityFiles>("files", "Files")
{
}
