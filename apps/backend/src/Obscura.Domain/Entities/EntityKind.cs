namespace Obscura.Domain.Entities;

/// <summary>
/// Code-defined entity kinds that Obscura understands at compile time.
/// </summary>
public enum EntityKindCode
{
    /// <summary>Playable video media.</summary>
    Video,

    /// <summary>Series, season, or other video grouping media.</summary>
    VideoSeries,

    /// <summary>Season or season-like structural grouping inside a video series.</summary>
    VideoSeason,

    /// <summary>Single image media.</summary>
    Image,

    /// <summary>Image gallery media.</summary>
    Gallery,

    /// <summary>Book, comic, or manga media.</summary>
    Book,

    /// <summary>Volume or volume-like structural grouping inside a book.</summary>
    BookVolume,

    /// <summary>Chapter or chapter-like readable unit inside a book.</summary>
    BookChapter,

    /// <summary>Single readable page inside a book chapter.</summary>
    BookPage,

    /// <summary>Generic audio media.</summary>
    Audio,

    /// <summary>Album, audiobook, podcast, or other audio grouping media.</summary>
    AudioLibrary,

    /// <summary>Single audio track media.</summary>
    AudioTrack,

    /// <summary>Person taxonomy entity.</summary>
    Person,

    /// <summary>Studio taxonomy entity.</summary>
    Studio,

    /// <summary>Tag taxonomy entity.</summary>
    Tag,

    /// <summary>User-curated collection entity.</summary>
    Collection
}

/// <summary>
/// Broad grouping used to separate media, taxonomy, collection, and system entities.
/// </summary>
public enum EntityKindCategory
{
    /// <summary>Playable, readable, or viewable library items.</summary>
    Media,

    /// <summary>Descriptive classification entities such as people, studios, and tags.</summary>
    Taxonomy,

    /// <summary>User-curated groupings of other entities.</summary>
    Collection,

    /// <summary>Internal entities that support app behavior rather than library browsing.</summary>
    System
}

/// <summary>
/// Describes a known entity kind without coupling domain code to route names or database rows.
/// </summary>
/// <param name="Value">Compile-time identity for the entity kind.</param>
/// <param name="Code">Stable code used in storage, URLs, and API filters.</param>
/// <param name="DisplayName">Human-readable label for diagnostics and future UI surfaces.</param>
/// <param name="Category">Broad category used for behavior grouping.</param>
public sealed record EntityKind(EntityKindCode Value, string Code, string DisplayName, EntityKindCategory Category);
