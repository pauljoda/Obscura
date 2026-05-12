using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Collects the reusable behaviors that can be mixed into any global entity.
/// </summary>
/// <param name="Rating">The user's optional rating for this entity.</param>
/// <param name="Tags">Shared tag names attached to this entity.</param>
/// <param name="Credits">People credited on this entity.</param>
/// <param name="Studio">The primary studio or publisher-like taxonomy entity.</param>
/// <param name="Images">Projected artwork and thumbnail locations.</param>
/// <param name="Links">External URLs and provider identifiers.</param>
/// <param name="Flags">User-facing boolean state, such as favorite and NSFW flags.</param>
/// <param name="Files">Physical or generated files associated with the entity.</param>
public sealed record EntityCapabilities(
    Rating? Rating,
    Tags Tags,
    Credits Credits,
    EntityReference? Studio,
    Images Images,
    Links Links,
    EntityFlags Flags,
    Files Files)
{
    /// <summary>
    /// A reusable capability set for entities before any optional capabilities have been attached.
    /// </summary>
    public static EntityCapabilities Empty { get; } = new(
        null,
        Tags.Empty,
        Credits.Empty,
        null,
        Images.Empty,
        Links.Empty,
        EntityFlags.Empty,
        Files.Empty);
}
