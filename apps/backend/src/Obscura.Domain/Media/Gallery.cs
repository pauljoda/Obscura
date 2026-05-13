using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for an image gallery.
/// </summary>
public sealed record Gallery : Entity
{
    /// <summary>
    /// Creates a gallery with explicit shared capabilities and gallery-only fields.
    /// </summary>
    public Gallery(
        Guid Id,
        string Title,
        string? Subtitle,
        GalleryType GalleryType,
        Guid? CoverImageId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Gallery,
            Title,
            Subtitle,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityCredits.Empty,
                new CapabilityStudio(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
        this.GalleryType = GalleryType;
        this.CoverImageId = CoverImageId;
    }

    /// <summary>Gallery storage shape.</summary>
    public GalleryType GalleryType { get; init; }

    /// <summary>Optional image entity selected as the gallery cover.</summary>
    public Guid? CoverImageId { get; init; }

    /// <summary>
    /// Creates a gallery from an already hydrated entity root.
    /// </summary>
    public Gallery(Entity entity, GalleryType GalleryType, Guid? CoverImageId)
        : this(entity.Id, entity.Title, entity.Subtitle, GalleryType, CoverImageId, entity.Capabilities)
    {
    }
}
