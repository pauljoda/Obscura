namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for shared user-facing boolean state.</summary>
public sealed class FlagsCapabilityKind()
    : CapabilityKind<CapabilityFlags>("flags", "Flags")
{
}
