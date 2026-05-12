namespace Obscura.Domain.Entities;

/// <summary>Book chapter structural entity kind.</summary>
public sealed record BookChapterEntityKind()
    : EntityKind(EntityKindCode.BookChapter, "book-chapter", "Book Chapter", EntityKindCategory.Media);
