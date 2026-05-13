using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for a tag taxonomy entity.
/// </summary>
public sealed record Tag : Entity
{
    /// <summary>
    /// Creates a tag with explicit shared capabilities and tag-specific automation state.
    /// </summary>
    public Tag(
        Guid Id,
        string Title,
        string? Subtitle,
        Guid? ParentTagId,
        bool IgnoreAutoTag,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Tag,
            Title,
            Subtitle,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
        this.ParentTagId = ParentTagId;
        this.IgnoreAutoTag = IgnoreAutoTag;
    }

    /// <summary>Optional parent tag entity identifier for hierarchical tags.</summary>
    public Guid? ParentTagId { get; init; }

    /// <summary>Whether automatic tagging should ignore this tag.</summary>
    public bool IgnoreAutoTag { get; init; }

    /// <summary>
    /// Creates a tag from an already hydrated entity root.
    /// </summary>
    public Tag(Entity entity, Guid? ParentTagId, bool IgnoreAutoTag)
        : this(entity.Id, entity.Title, entity.Subtitle, ParentTagId, IgnoreAutoTag, entity.Capabilities)
    {
    }
}
