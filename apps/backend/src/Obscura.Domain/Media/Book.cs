using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a book, comic, manga, or other page-based media item.
/// </summary>
/// <param name="Id">Shared global entity identifier.</param>
/// <param name="Title">Display title inherited from the shared entity root.</param>
/// <param name="Subtitle">Optional display subtitle inherited from the shared entity root.</param>
public sealed record Book(
    Guid Id,
    string Title,
    string? Subtitle,
    BookType BookType,
    string? SortTitle,
    string? Summary,
    string? Date,
    string? FolderPath,
    string? RelativePath,
    Guid? CoverPageId,
    string? CoverImagePath,
    int PageCount,
    int ChapterCount,
    Guid? CurrentChapterId,
    int CurrentPageIndex,
    int CurrentChapterPageCount,
    ReaderMode ReaderMode,
    DateTimeOffset? CompletedAt)
    : Entity(
        Id,
        EntityKindRegistry.Book,
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
    /// Creates a book from an already hydrated entity root.
    /// </summary>
    public Book(
        Entity entity,
        BookType BookType,
        string? SortTitle,
        string? Summary,
        string? Date,
        string? FolderPath,
        string? RelativePath,
        Guid? CoverPageId,
        string? CoverImagePath,
        int PageCount,
        int ChapterCount,
        Guid? CurrentChapterId,
        int CurrentPageIndex,
        int CurrentChapterPageCount,
        ReaderMode ReaderMode,
        DateTimeOffset? CompletedAt)
        : this(
            entity.Id,
            entity.Title,
            entity.Subtitle,
            BookType,
            SortTitle,
            Summary,
            Date,
            FolderPath,
            RelativePath,
            CoverPageId,
            CoverImagePath,
            PageCount,
            ChapterCount,
            CurrentChapterId,
            CurrentPageIndex,
            CurrentChapterPageCount,
            ReaderMode,
            CompletedAt)
    {
        Capabilities = entity.Capabilities;
    }

    /// <summary>
    /// Returns a copy of the book with its reading cursor moved to a chapter and page.
    /// </summary>
    /// <param name="chapterId">Chapter currently being read.</param>
    /// <param name="pageIndex">Zero-based page index within the chapter.</param>
    /// <param name="pageCount">Total pages in the active chapter.</param>
    /// <param name="readerMode">Reader layout selected by the user.</param>
    /// <returns>A new book instance with updated reading progress.</returns>
    public Book MoveReaderToChapter(Guid chapterId, int pageIndex, int pageCount, ReaderMode readerMode)
    {
        var normalizedPageCount = Math.Max(0, pageCount);
        var normalizedPageIndex = normalizedPageCount == 0
            ? 0
            : Math.Clamp(pageIndex, 0, normalizedPageCount - 1);

        return this with
        {
            CurrentChapterId = chapterId,
            CurrentPageIndex = normalizedPageIndex,
            CurrentChapterPageCount = normalizedPageCount,
            ReaderMode = readerMode,
            CompletedAt = null
        };
    }

    /// <summary>
    /// Returns a copy of the book marked as completed at the supplied time.
    /// </summary>
    /// <param name="completedAt">Timestamp when the book was completed.</param>
    /// <returns>A new book instance with completed reading progress.</returns>
    public Book MarkCompleted(DateTimeOffset completedAt) =>
        this with { CompletedAt = completedAt };
}
