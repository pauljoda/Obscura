namespace Obscura.Domain.Entities;

/// <summary>
/// Domain metadata that describes the broad storage shape and structural child kinds for an entity kind.
/// </summary>
/// <param name="Kind">Entity kind described by this metadata.</param>
/// <param name="StorageShape">Filesystem storage shape this kind normally represents.</param>
/// <param name="AllowedChildKinds">Entity kinds that can be structural children.</param>
public sealed record EntityKindMetadata(
    EntityKind Kind,
    EntityStorageShape StorageShape,
    IReadOnlyList<EntityKind> AllowedChildKinds);

/// <summary>
/// Provides domain-only metadata for known entity kinds without involving storage or API strings.
/// </summary>
public static class EntityKindMetadataRegistry {
    private static readonly IReadOnlyDictionary<EntityKind, EntityKindMetadata> Items = new Dictionary<EntityKind, EntityKindMetadata> {
        [EntityKind.VideoSeries] = new(EntityKind.VideoSeries, EntityStorageShape.Folder, [EntityKind.VideoSeason, EntityKind.Video]),
        [EntityKind.VideoSeason] = new(EntityKind.VideoSeason, EntityStorageShape.Folder, [EntityKind.Video]),
        [EntityKind.Video] = new(EntityKind.Video, EntityStorageShape.File, []),
        [EntityKind.Gallery] = new(EntityKind.Gallery, EntityStorageShape.Folder, [EntityKind.Gallery, EntityKind.Image]),
        [EntityKind.Image] = new(EntityKind.Image, EntityStorageShape.File, []),
        [EntityKind.AudioLibrary] = new(EntityKind.AudioLibrary, EntityStorageShape.Folder, [EntityKind.AudioLibrary, EntityKind.AudioTrack]),
        [EntityKind.AudioTrack] = new(EntityKind.AudioTrack, EntityStorageShape.File, []),
        [EntityKind.Audio] = new(EntityKind.Audio, EntityStorageShape.File, []),
        [EntityKind.Book] = new(EntityKind.Book, EntityStorageShape.Archive, [EntityKind.BookVolume, EntityKind.BookChapter, EntityKind.BookPage]),
        [EntityKind.BookVolume] = new(EntityKind.BookVolume, EntityStorageShape.None, [EntityKind.BookChapter, EntityKind.BookPage]),
        [EntityKind.BookChapter] = new(EntityKind.BookChapter, EntityStorageShape.None, [EntityKind.BookPage]),
        [EntityKind.BookPage] = new(EntityKind.BookPage, EntityStorageShape.ArchiveEntry, []),
        [EntityKind.Person] = new(EntityKind.Person, EntityStorageShape.None, []),
        [EntityKind.Studio] = new(EntityKind.Studio, EntityStorageShape.None, [EntityKind.Studio]),
        [EntityKind.Tag] = new(EntityKind.Tag, EntityStorageShape.None, [EntityKind.Tag]),
        [EntityKind.Collection] = new(EntityKind.Collection, EntityStorageShape.None, Enum.GetValues<EntityKind>())
    };

    /// <summary>
    /// Gets metadata for an entity kind.
    /// </summary>
    /// <param name="kind">Entity kind to describe.</param>
    /// <returns>Metadata for the requested kind.</returns>
    public static EntityKindMetadata Require(EntityKind kind) => Items[kind];
}
