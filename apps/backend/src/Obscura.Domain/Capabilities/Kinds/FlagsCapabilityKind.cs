namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for shared user-facing boolean state.</summary>
public sealed record FlagsCapabilityKind()
    : ICapabilityKind<CapabilityFlags>
{
    public string Code => "flags";
    public string DisplayName => "Flags";
    public Type CapabilityType => typeof(CapabilityFlags);
}
