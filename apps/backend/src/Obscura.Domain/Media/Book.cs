using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a book, comic, manga, or other page-based media item.
/// </summary>
/// <param name="Id">Stable global entity identifier inherited from the root entity model.</param>
/// <param name="Title">Primary user-facing title inherited from the root entity model.</param>
/// <param name="Subtitle">Optional secondary card/detail text inherited from the root entity model.</param>
/// <param name="Capabilities">Shared capabilities attached to the book, such as ratings, tags, people, studio, artwork, and files.</param>
/// <param name="Details">Book-specific metadata and scan state.</param>
/// <param name="ReadProgress">Single-user reading progress for the book.</param>
public sealed record Book(
    Guid Id,
    string Title,
    string? Subtitle,
    EntityCapabilities Capabilities,
    BookDetails Details,
    BookReadProgress ReadProgress)
    : Entity(Id, EntityKind.Book, Title, Subtitle, Capabilities)
{
    /// <summary>
    /// Returns a copy of the book with new book-specific metadata.
    /// </summary>
    /// <param name="details">Replacement book-specific metadata.</param>
    /// <returns>A new book instance with unchanged shared entity fields and updated details.</returns>
    public Book WithDetails(BookDetails details) => this with { Details = details };

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
            ReadProgress = ReadProgress with
            {
                ChapterId = chapterId,
                PageIndex = normalizedPageIndex,
                PageCount = normalizedPageCount,
                ReaderMode = readerMode,
                CompletedAt = null
            }
        };
    }

    /// <summary>
    /// Returns a copy of the book marked as completed at the supplied time.
    /// </summary>
    /// <param name="completedAt">Timestamp when the book was completed.</param>
    /// <returns>A new book instance with completed reading progress.</returns>
    public Book MarkCompleted(DateTimeOffset completedAt) =>
        this with { ReadProgress = ReadProgress with { CompletedAt = completedAt } };
}

/// <summary>
/// Book-specific metadata that should not live on the shared global entity root.
/// </summary>
/// <param name="BookType">Closed book category used by scanning, readers, and provider adapters.</param>
/// <param name="SortTitle">Optional normalized title used for sorting.</param>
/// <param name="Summary">Book synopsis or freeform details.</param>
/// <param name="Date">Release or publication date as provider/user-facing text.</param>
/// <param name="FolderPath">Source folder path when the book was discovered from a folder.</param>
/// <param name="RelativePath">Path relative to the library root.</param>
/// <param name="CoverPageId">Optional page entity selected as the cover.</param>
/// <param name="CoverImagePath">Optional generated or uploaded cover image path.</param>
/// <param name="PageCount">Total projected pages across all chapters.</param>
/// <param name="ChapterCount">Total projected chapters.</param>
public sealed record BookDetails(
    BookType BookType,
    string? SortTitle,
    string? Summary,
    string? Date,
    string? FolderPath,
    string? RelativePath,
    Guid? CoverPageId,
    string? CoverImagePath,
    int PageCount,
    int ChapterCount)
{
    /// <summary>
    /// Empty book details used before scan or provider metadata is attached.
    /// </summary>
    public static BookDetails Empty { get; } = new(BookType.Book, null, null, null, null, null, null, null, 0, 0);
}

/// <summary>
/// Reading progress for a book in Obscura's single-user library model.
/// </summary>
/// <param name="ChapterId">Current chapter entity identifier, when reading has started.</param>
/// <param name="PageIndex">Zero-based current page index within the chapter.</param>
/// <param name="PageCount">Total page count in the active chapter.</param>
/// <param name="ReaderMode">Reader layout selected by the user.</param>
/// <param name="CompletedAt">Completion timestamp when the book has been read through.</param>
public sealed record BookReadProgress(
    Guid? ChapterId,
    int PageIndex,
    int PageCount,
    ReaderMode ReaderMode,
    DateTimeOffset? CompletedAt)
{
    /// <summary>
    /// Empty reading progress for books that have not been opened yet.
    /// </summary>
    public static BookReadProgress Empty { get; } = new(null, 0, 0, ReaderMode.Paged, null);
}
