namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of page-based media categories supported by the core book model.
/// </summary>
public enum BookType
{
    /// <summary>Default book-shaped item when no narrower category is known.</summary>
    Book,

    /// <summary>Sequential art or comic archive content.</summary>
    Comic,

    /// <summary>Manga content, usually read with manga-specific ordering or layout affordances.</summary>
    Manga,

    /// <summary>Long-form prose content.</summary>
    Novel
}

/// <summary>
/// Codec for book category codes stored in rows and exposed through contracts.
/// </summary>
public sealed class BookTypeCodec : EnumCodec<BookType>
{
    public BookTypeCodec()
        : base(new Dictionary<BookType, string>
        {
            [BookType.Book] = "book",
            [BookType.Comic] = "comic",
            [BookType.Manga] = "manga",
            [BookType.Novel] = "novel"
        })
    {
    }
}
