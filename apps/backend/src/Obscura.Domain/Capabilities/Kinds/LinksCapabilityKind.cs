namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for external links and provider identifiers.</summary>
public sealed record LinksCapabilityKind()
    : ICapabilityKind<CapabilityLinks>
{
    public string Code => "links";
    public string DisplayName => "Links";
    public Type CapabilityType => typeof(CapabilityLinks);
}
