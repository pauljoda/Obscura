using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Structural book volume aggregate used by chaptered or volume-grouped books.
/// </summary>
public sealed record BookVolume(Entity Entity, BookVolumeDetails Details);

/// <summary>
/// Book-volume-specific hierarchy and artwork metadata.
/// </summary>
public sealed record BookVolumeDetails(
    Guid BookId,
    int? VolumeNumber,
    string? FolderPath,
    string? RelativePath,
    string? CoverImagePath)
{
    /// <summary>Empty volume details used before hierarchy metadata is attached.</summary>
    public static BookVolumeDetails Empty { get; } = new(Guid.Empty, null, null, null, null);
}

/// <summary>
/// Structural book chapter aggregate used by readers and book hierarchy traversal.
/// </summary>
public sealed record BookChapter(Entity Entity, BookChapterDetails Details);

/// <summary>
/// Book-chapter-specific hierarchy and source archive metadata.
/// </summary>
public sealed record BookChapterDetails(
    Guid BookId,
    Guid? VolumeId,
    int ChapterNumber,
    string? ArchivePath,
    string? RelativePath,
    int PageCount,
    Guid? CoverPageId)
{
    /// <summary>Empty chapter details used before hierarchy metadata is attached.</summary>
    public static BookChapterDetails Empty { get; } = new(Guid.Empty, null, 0, null, null, 0, null);
}

/// <summary>
/// Structural book page aggregate used by readers and image projection.
/// </summary>
public sealed record BookPage(Entity Entity, BookPageDetails Details);

/// <summary>
/// Book-page-specific source file and probe metadata.
/// </summary>
public sealed record BookPageDetails(
    Guid BookId,
    Guid ChapterId,
    string FilePath,
    long? FileSizeBytes,
    int? Width,
    int? Height,
    string? Format,
    int SortOrder)
{
    /// <summary>Empty page details used before file metadata is attached.</summary>
    public static BookPageDetails Empty { get; } = new(Guid.Empty, Guid.Empty, string.Empty, null, null, null, null, 0);
}
