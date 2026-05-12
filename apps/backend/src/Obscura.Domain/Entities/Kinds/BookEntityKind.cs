namespace Obscura.Domain.Entities;

/// <summary>Book, comic, or manga entity kind.</summary>
public sealed record BookEntityKind()
    : EntityKind(EntityKindCode.Book, "book", "Book", EntityKindCategory.Media);
