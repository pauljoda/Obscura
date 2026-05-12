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
    EntityCapabilities Capabilities,
    GalleryDetails Details)
    : Entity(Id, EntityKinds.Gallery, Title, Subtitle, Capabilities)
{
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
