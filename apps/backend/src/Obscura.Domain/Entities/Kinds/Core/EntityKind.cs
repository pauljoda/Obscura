namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of entity kinds owned by the domain model.
/// </summary>
public enum EntityKind {
    /// <summary>Generic audio media root.</summary>
    Audio,

    /// <summary>Audio library, album, audiobook, or podcast grouping.</summary>
    AudioLibrary,

    /// <summary>Playable audio track.</summary>
    AudioTrack,

    /// <summary>Book, comic, manga, or other page-based media item.</summary>
    Book,

    /// <summary>Structural book volume.</summary>
    BookVolume,

    /// <summary>Structural book chapter.</summary>
    BookChapter,

    /// <summary>Structural book page.</summary>
    BookPage,

    /// <summary>User collection.</summary>
    Collection,

    /// <summary>Image gallery.</summary>
    Gallery,

    /// <summary>Single image.</summary>
    Image,

    /// <summary>Person taxonomy entity.</summary>
    Person,

    /// <summary>Studio, publisher, label, or production group.</summary>
    Studio,

    /// <summary>Tag taxonomy entity.</summary>
    Tag,

    /// <summary>Playable video media item.</summary>
    Video,

    /// <summary>Video series grouping.</summary>
    VideoSeries,

    /// <summary>Structural video season.</summary>
    VideoSeason
}
