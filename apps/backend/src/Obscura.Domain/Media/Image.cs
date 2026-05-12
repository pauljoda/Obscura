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
    string? Summary,
    string? Date,
    string? FilePath,
    long? FileSizeBytes,
    int? Width,
    int? Height,
    string? Format,
    int SortOrder)
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
    public Image(
        Entity entity,
        string? Summary,
        string? Date,
        string? FilePath,
        long? FileSizeBytes,
        int? Width,
        int? Height,
        string? Format,
        int SortOrder)
        : this(entity.Id, entity.Title, entity.Subtitle, Summary, Date, FilePath, FileSizeBytes, Width, Height, Format, SortOrder)
    {
        Capabilities = entity.Capabilities;
    }
}
