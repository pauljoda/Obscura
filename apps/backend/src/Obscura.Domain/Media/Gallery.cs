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
    string? Summary,
    string? Date,
    GalleryType GalleryType,
    string? FolderPath,
    string? ZipFilePath,
    string? Photographer,
    Guid? CoverImageId,
    int ImageCount)
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
    public Gallery(
        Entity entity,
        string? Summary,
        string? Date,
        GalleryType GalleryType,
        string? FolderPath,
        string? ZipFilePath,
        string? Photographer,
        Guid? CoverImageId,
        int ImageCount)
        : this(entity.Id, entity.Title, entity.Subtitle, Summary, Date, GalleryType, FolderPath, ZipFilePath, Photographer, CoverImageId, ImageCount)
    {
        Capabilities = entity.Capabilities;
    }
}
