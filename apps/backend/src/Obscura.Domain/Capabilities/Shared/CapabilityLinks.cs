namespace Obscura.Domain.Capabilities;

/// <summary>
/// Link capability for an entity that supports external references.
/// </summary>
/// <param name="Urls">User-visible URLs for the entity.</param>
/// <param name="ExternalIds">Provider identifiers that can be used for future refreshes or matching.</param>
public sealed record CapabilityLinks(
    IReadOnlyList<EntityUrl> Urls,
    IReadOnlyList<EntityExternalId> ExternalIds) : ICapability
{
    public ICapabilityKind Kind => CapabilityRegistry.Links;

    /// <summary>A reusable empty link capability.</summary>
    public static CapabilityLinks Empty { get; } = new([], []);
}
