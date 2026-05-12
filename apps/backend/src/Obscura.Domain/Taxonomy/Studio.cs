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
    string? Description,
    Guid? ParentStudioId)
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
    public Studio(Entity entity, string? Description, Guid? ParentStudioId)
        : this(entity.Id, entity.Title, entity.Subtitle, Description, ParentStudioId)
    {
        Capabilities = entity.Capabilities;
    }
}
