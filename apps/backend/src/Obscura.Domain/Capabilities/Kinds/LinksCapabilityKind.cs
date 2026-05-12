namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for external links and provider identifiers.</summary>
public sealed class LinksCapabilityKind()
    : CapabilityKind<CapabilityLinks>("links", "Links")
{
}
