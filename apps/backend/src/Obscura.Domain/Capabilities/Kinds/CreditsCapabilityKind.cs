namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for credited people.</summary>
public sealed class CreditsCapabilityKind()
    : CapabilityKind<CapabilityCredits>("credits", "Credits")
{
}
