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
        bool IgnoreAutoTag,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Tag,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
        this.IgnoreAutoTag = IgnoreAutoTag;
    }

    /// <summary>Whether automatic tagging should ignore this tag.</summary>
    public bool IgnoreAutoTag { get; init; }

    /// <summary>
    /// Creates a tag from an already hydrated entity root.
    /// </summary>
    public Tag(Entity entity, bool IgnoreAutoTag)
        : this(entity.Id, entity.Title, IgnoreAutoTag, entity.Capabilities)
    {
    }
}
