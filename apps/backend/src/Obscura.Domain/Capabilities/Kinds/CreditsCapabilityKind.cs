namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for credited people.</summary>
public sealed record CreditsCapabilityKind()
    : ICapabilityKind<CapabilityCredits>
{
    public string Code => "credits";
    public string DisplayName => "Credits";
    public Type CapabilityType => typeof(CapabilityCredits);
}
