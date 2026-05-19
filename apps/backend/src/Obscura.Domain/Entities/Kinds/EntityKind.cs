namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of entity kinds owned by the domain model. Each member declares its stable
/// code and taxonomy metadata inline; <see cref="EntityKindRegistry"/> builds itself from
/// these attributes.
/// </summary>
public enum EntityKind {
    /// <summary>Generic audio media root.</summary>
    [Code("audio")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.File)]
    Audio,

    /// <summary>Audio library, album, audiobook, or podcast grouping.</summary>
    [Code("audio-library")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.AudioLibrary))]
    AudioLibrary,

    /// <summary>Playable audio track.</summary>
    [Code("audio-track")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.File, typeof(Obscura.Domain.Media.AudioTrack))]
    AudioTrack,

    /// <summary>Book, comic, manga, or other page-based media item.</summary>
    [Code("book")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.Archive, typeof(Obscura.Domain.Media.Book))]
    Book,

    /// <summary>Structural book volume.</summary>
    [Code("book-volume")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.None, typeof(Obscura.Domain.Media.BookVolume))]
    BookVolume,

    /// <summary>Structural book chapter.</summary>
    [Code("book-chapter")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.None, typeof(Obscura.Domain.Media.BookChapter))]
    BookChapter,

    /// <summary>Structural book page.</summary>
    [Code("book-page")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.ArchiveEntry, typeof(Obscura.Domain.Media.BookPage))]
    BookPage,

    /// <summary>User collection.</summary>
    [Code("collection")]
    [EntityKindMeta(EntityKindCategory.Collection, EntityStorageShape.None, typeof(Obscura.Domain.Media.Collection))]
    Collection,

    /// <summary>Image gallery.</summary>
    [Code("gallery")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.Gallery))]
    Gallery,

    /// <summary>Single image.</summary>
    [Code("image")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.File, typeof(Obscura.Domain.Media.Image))]
    Image,

    /// <summary>Person taxonomy entity.</summary>
    [Code("person")]
    [EntityKindMeta(EntityKindCategory.Taxonomy, EntityStorageShape.None, typeof(Obscura.Domain.Taxonomy.Person))]
    Person,

    /// <summary>Studio, publisher, label, or production group.</summary>
    [Code("studio")]
    [EntityKindMeta(EntityKindCategory.Taxonomy, EntityStorageShape.None, typeof(Obscura.Domain.Taxonomy.Studio))]
    Studio,

    /// <summary>Tag taxonomy entity.</summary>
    [Code("tag")]
    [EntityKindMeta(EntityKindCategory.Taxonomy, EntityStorageShape.None, typeof(Obscura.Domain.Taxonomy.Tag))]
    Tag,

    /// <summary>Playable video media item.</summary>
    [Code("video")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.File, typeof(Obscura.Domain.Media.Video))]
    Video,

    /// <summary>Video series grouping.</summary>
    [Code("video-series")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.VideoSeries))]
    VideoSeries,

    /// <summary>Structural video season.</summary>
    [Code("video-season")]
    [EntityKindMeta(EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.VideoSeason))]
    VideoSeason
}
