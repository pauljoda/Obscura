using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a single image entity.
/// </summary>
public sealed record Image(
    Guid Id,
    string Title,
    string? Subtitle,
    ImageDetails Details)
    : Entity(
        Id,
        EntityKindRegistry.Image,
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
    /// Creates an image from an already hydrated entity root.
    /// </summary>
    public Image(Entity entity, ImageDetails details)
        : this(entity.Id, entity.Title, entity.Subtitle, details)
    {
        Capabilities = entity.Capabilities;
    }

    /// <summary>
    /// Returns a copy of the image with updated image-specific metadata.
    /// </summary>
    public Image WithDetails(ImageDetails details) => this with { Details = details };
}

/// <summary>
/// Image-specific metadata and probe fields.
/// </summary>
public sealed record ImageDetails(
    string? Summary,
    string? Date,
    string? FilePath,
    long? FileSizeBytes,
    int? Width,
    int? Height,
    string? Format,
    int SortOrder)
{
    /// <summary>
    /// Empty image details used before scan or probe data is attached.
    /// </summary>
    public static ImageDetails Empty { get; } = new(null, null, null, null, null, null, null, 0);
}
