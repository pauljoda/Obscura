namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for physical or generated files.</summary>
public sealed record FilesCapabilityKind()
    : ICapabilityKind<CapabilityFiles>
{
    public string Code => "files";
    public string DisplayName => "Files";
    public Type CapabilityType => typeof(CapabilityFiles);
}
