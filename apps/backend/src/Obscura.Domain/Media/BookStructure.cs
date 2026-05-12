using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Structural book volume aggregate used by chaptered or volume-grouped books.
/// </summary>
public sealed record BookVolume(
    Guid Id,
    string Title,
    string? Subtitle,
    Guid BookId,
    int? VolumeNumber,
    string? FolderPath,
    string? RelativePath,
    string? CoverImagePath)
    : Entity(
        Id,
        EntityKindRegistry.BookVolume,
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
    /// Creates a book volume from an already hydrated entity root.
    /// </summary>
    public BookVolume(
        Entity entity,
        Guid BookId,
        int? VolumeNumber,
        string? FolderPath,
        string? RelativePath,
        string? CoverImagePath)
        : this(entity.Id, entity.Title, entity.Subtitle, BookId, VolumeNumber, FolderPath, RelativePath, CoverImagePath)
    {
        Capabilities = entity.Capabilities;
    }
}

/// <summary>
/// Structural book chapter aggregate used by readers and book hierarchy traversal.
/// </summary>
public sealed record BookChapter(
    Guid Id,
    string Title,
    string? Subtitle,
    Guid BookId,
    Guid? VolumeId,
    int ChapterNumber,
    string? ArchivePath,
    string? RelativePath,
    int PageCount,
    Guid? CoverPageId)
    : Entity(
        Id,
        EntityKindRegistry.BookChapter,
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
    /// Creates a book chapter from an already hydrated entity root.
    /// </summary>
    public BookChapter(
        Entity entity,
        Guid BookId,
        Guid? VolumeId,
        int ChapterNumber,
        string? ArchivePath,
        string? RelativePath,
        int PageCount,
        Guid? CoverPageId)
        : this(entity.Id, entity.Title, entity.Subtitle, BookId, VolumeId, ChapterNumber, ArchivePath, RelativePath, PageCount, CoverPageId)
    {
        Capabilities = entity.Capabilities;
    }
}

/// <summary>
/// Structural book page aggregate used by readers and image projection.
/// </summary>
public sealed record BookPage(
    Guid Id,
    string Title,
    string? Subtitle,
    Guid BookId,
    Guid ChapterId,
    string FilePath,
    long? FileSizeBytes,
    int? Width,
    int? Height,
    string? Format,
    int SortOrder)
    : Entity(
        Id,
        EntityKindRegistry.BookPage,
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
    /// Creates a book page from an already hydrated entity root.
    /// </summary>
    public BookPage(
        Entity entity,
        Guid BookId,
        Guid ChapterId,
        string FilePath,
        long? FileSizeBytes,
        int? Width,
        int? Height,
        string? Format,
        int SortOrder)
        : this(entity.Id, entity.Title, entity.Subtitle, BookId, ChapterId, FilePath, FileSizeBytes, Width, Height, Format, SortOrder)
    {
        Capabilities = entity.Capabilities;
    }
}
