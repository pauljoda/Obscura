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
    StudioDetails Details)
    : Entity(
        Id,
        EntityKindRegistry.Studio,
        Title,
        Subtitle,
        [
            new CapabilityRating(null),
            CapabilityTags.Empty,
            CapabilityImages.Empty,
            CapabilityLinks.Empty,
            CapabilityFlags.Empty,
            CapabilityFiles.Empty
        ])
{
    /// <summary>
    /// Creates a studio from an already hydrated entity root.
    /// </summary>
    public Studio(Entity entity, StudioDetails details)
        : this(entity.Id, entity.Title, entity.Subtitle, details)
    {
        Capabilities = entity.Capabilities;
    }

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
