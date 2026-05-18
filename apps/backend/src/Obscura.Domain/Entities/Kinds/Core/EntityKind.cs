using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;

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

/// <summary>
/// Domain-only metadata for mapping concrete entity CLR types to their entity kind.
/// </summary>
public static class EntityKindCatalog {
    private static readonly IReadOnlyDictionary<Type, EntityKind> TypeMap = new Dictionary<Type, EntityKind> {
        [typeof(AudioLibrary)] = EntityKind.AudioLibrary,
        [typeof(AudioTrack)] = EntityKind.AudioTrack,
        [typeof(Book)] = EntityKind.Book,
        [typeof(BookVolume)] = EntityKind.BookVolume,
        [typeof(BookChapter)] = EntityKind.BookChapter,
        [typeof(BookPage)] = EntityKind.BookPage,
        [typeof(Collection)] = EntityKind.Collection,
        [typeof(Gallery)] = EntityKind.Gallery,
        [typeof(Image)] = EntityKind.Image,
        [typeof(Person)] = EntityKind.Person,
        [typeof(Studio)] = EntityKind.Studio,
        [typeof(Tag)] = EntityKind.Tag,
        [typeof(Video)] = EntityKind.Video,
        [typeof(VideoSeries)] = EntityKind.VideoSeries,
        [typeof(VideoSeason)] = EntityKind.VideoSeason
    };

    /// <summary>
    /// Gets the entity kind for a concrete domain entity type.
    /// </summary>
    /// <param name="entityType">Concrete entity CLR type.</param>
    /// <returns>The entity kind represented by the type.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the type is not registered as a concrete entity.</exception>
    public static EntityKind Require(Type entityType) {
        ArgumentNullException.ThrowIfNull(entityType);
        return TypeMap.TryGetValue(entityType, out var kind)
            ? kind
            : throw new InvalidOperationException($"Entity type '{entityType.Name}' is not registered.");
    }
}
