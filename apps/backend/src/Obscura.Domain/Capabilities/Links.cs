namespace Obscura.Domain.Capabilities;

/// <summary>
/// Groups external references so provider links and provider IDs travel together as one capability.
/// </summary>
/// <param name="Urls">User-visible URLs for the entity.</param>
/// <param name="ExternalIds">Provider identifiers that can be used for future refreshes or matching.</param>
public sealed record Links(
    IReadOnlyList<EntityUrl> Urls,
    IReadOnlyList<EntityExternalId> ExternalIds)
{
    /// <summary>
    /// A reusable empty link set for entities with no external references.
    /// </summary>
    public static Links Empty { get; } = new([], []);
}
