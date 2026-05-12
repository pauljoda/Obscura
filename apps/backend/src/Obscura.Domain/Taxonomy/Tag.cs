using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for a tag taxonomy entity.
/// </summary>
public sealed record Tag(
    Guid Id,
    string Title,
    string? Subtitle,
    string? Description,
    Guid? ParentTagId,
    bool IgnoreAutoTag)
    : Entity(
        Id,
        EntityKindRegistry.Tag,
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
    /// Creates a tag from an already hydrated entity root.
    /// </summary>
    public Tag(Entity entity, string? Description, Guid? ParentTagId, bool IgnoreAutoTag)
        : this(entity.Id, entity.Title, entity.Subtitle, Description, ParentTagId, IgnoreAutoTag)
    {
        Capabilities = entity.Capabilities;
    }
}
