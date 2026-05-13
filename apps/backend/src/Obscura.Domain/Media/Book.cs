using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a book, comic, manga, or other page-based media item.
/// </summary>
public sealed record Book : Entity
{
    /// <summary>
    /// Creates a book with explicit shared capabilities and book-only fields.
    /// </summary>
    public Book(
        Guid Id,
        string Title,
        string? Subtitle,
        BookType BookType,
        Guid? CoverPageId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Book,
            Title,
            Subtitle,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityCredits.Empty,
                new CapabilityStudio(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty,
                CapabilityProgress.Empty
            ])
    {
        this.BookType = BookType;
        this.CoverPageId = CoverPageId;
    }

    /// <summary>Book category such as book, comic, or manga.</summary>
    public BookType BookType { get; init; }

    /// <summary>Optional page entity selected as the book cover.</summary>
    public Guid? CoverPageId { get; init; }

    /// <summary>
    /// Creates a book from an already hydrated entity root.
    /// </summary>
    public Book(Entity entity, BookType BookType, Guid? CoverPageId)
        : this(entity.Id, entity.Title, entity.Subtitle, BookType, CoverPageId, entity.Capabilities)
    {
    }

    /// <summary>
    /// Returns a copy of the book with its reading cursor moved to a chapter and page.
    /// </summary>
    public Book MoveReaderToChapter(Guid chapterId, int pageIndex, int pageCount, ReaderMode readerMode)
    {
        var normalizedPageCount = Math.Max(0, pageCount);
        var normalizedPageIndex = normalizedPageCount == 0
            ? 0
            : Math.Clamp(pageIndex, 0, normalizedPageCount - 1);

        return this with
        {
            Capabilities = WithCapability(
                CapabilityRegistry.Progress,
                new CapabilityProgress(
                    chapterId,
                    "page",
                    normalizedPageIndex,
                    normalizedPageCount,
                    readerMode.ToCode(),
                    null,
                    DateTimeOffset.UtcNow)).Capabilities
        };
    }

    /// <summary>
    /// Returns a copy of the book marked as completed at the supplied time.
    /// </summary>
    public Book MarkCompleted(DateTimeOffset completedAt)
    {
        var current = Progress ?? CapabilityProgress.Empty;
        return this with
        {
            Capabilities = WithCapability(
                CapabilityRegistry.Progress,
                current with { CompletedAt = completedAt, UpdatedAt = completedAt }).Capabilities
        };
    }
}
