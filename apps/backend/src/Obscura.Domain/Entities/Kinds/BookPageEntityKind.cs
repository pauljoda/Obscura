namespace Obscura.Domain.Entities;

/// <summary>Book page structural entity kind.</summary>
public sealed record BookPageEntityKind()
    : EntityKind(EntityKindCode.BookPage, "book-page", "Book Page", EntityKindCategory.Media);
