using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for studio, publisher, label, or production-group taxonomy entities.
/// </summary>
public sealed record Studio(
    Guid Id,
    string Title,
    string? Subtitle,
    IReadOnlyList<ICapability> Capabilities,
    StudioDetails Details)
    : Entity(Id, EntityKindRegistry.Studio, Title, Subtitle, Capabilities)
{
    /// <summary>
    /// Returns a copy of the studio with updated studio-specific metadata.
    /// </summary>
    public Studio WithDetails(StudioDetails details) => this with { Details = details };
}

/// <summary>
/// Studio-specific metadata for hierarchical studio/publisher relationships.
/// </summary>
/// <param name="Description">Freeform studio description.</param>
/// <param name="ParentStudioId">Optional parent studio entity identifier.</param>
public sealed record StudioDetails(string? Description, Guid? ParentStudioId)
{
    /// <summary>
    /// Empty studio details used before metadata is attached.
    /// </summary>
    public static StudioDetails Empty { get; } = new(null, null);
}
