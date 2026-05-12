using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for an album, audiobook, podcast, or other audio grouping.
/// </summary>
public sealed record AudioLibrary(
    Guid Id,
    string Title,
    string? Subtitle,
    string? Summary,
    string? Date,
    string? FolderPath,
    Guid? ParentLibraryId,
    int TrackCount)
    : Entity(
        Id,
        EntityKindRegistry.AudioLibrary,
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
    /// Creates an audio library from an already hydrated entity root.
    /// </summary>
    public AudioLibrary(
        Entity entity,
        string? Summary,
        string? Date,
        string? FolderPath,
        Guid? ParentLibraryId,
        int TrackCount)
        : this(entity.Id, entity.Title, entity.Subtitle, Summary, Date, FolderPath, ParentLibraryId, TrackCount)
    {
        Capabilities = entity.Capabilities;
    }
}
