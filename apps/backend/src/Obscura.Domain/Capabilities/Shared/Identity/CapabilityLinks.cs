namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable link capability for entities that support external references.
/// </summary>
public sealed class CapabilityLinks : EntityCapability {
    public CapabilityLinks(IReadOnlyList<EntityUrl>? urls = null, IReadOnlyList<EntityExternalId>? externalIds = null) {
        Urls = urls?.ToArray() ?? [];
        ExternalIds = externalIds?.ToArray() ?? [];
    }

    public IReadOnlyList<EntityUrl> Urls { get; private set; }
    public IReadOnlyList<EntityExternalId> ExternalIds { get; private set; }
}
