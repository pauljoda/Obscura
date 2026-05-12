using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for an image gallery.
/// </summary>
public sealed record Gallery(
    Guid Id,
    string Title,
    string? Subtitle,
    GalleryDetails Details)
    : Entity(
        Id,
        EntityKindRegistry.Gallery,
        Title,
        Subtitle,
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
    /// <summary>
    /// Creates a gallery from an already hydrated entity root.
    /// </summary>
    public Gallery(Entity entity, GalleryDetails details)
        : this(entity.Id, entity.Title, entity.Subtitle, details)
    {
        Capabilities = entity.Capabilities;
    }

    /// <summary>
    /// Returns a copy of the gallery with updated gallery-specific metadata.
    /// </summary>
    public Gallery WithDetails(GalleryDetails details) => this with { Details = details };
}

/// <summary>
/// Gallery-specific metadata and scan fields.
/// </summary>
public sealed record GalleryDetails(
    string? Summary,
    string? Date,
    GalleryType GalleryType,
    string? FolderPath,
    string? ZipFilePath,
    string? Photographer,
    Guid? CoverImageId,
    int ImageCount)
{
    /// <summary>
    /// Empty gallery details used before scan metadata is attached.
    /// </summary>
    public static GalleryDetails Empty { get; } = new(null, null, GalleryType.Virtual, null, null, null, null, 0);
}
