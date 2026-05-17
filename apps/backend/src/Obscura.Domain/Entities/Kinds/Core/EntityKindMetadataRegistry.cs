namespace Obscura.Domain.Entities;

/// <summary>
/// Scan and organization metadata for one entity kind.
/// </summary>
/// <param name="Kind">Entity kind this metadata describes.</param>
/// <param name="StorageShape">Filesystem storage shape for scan and organize rules.</param>
/// <param name="AllowedChildKinds">Child kinds this entity can group through the generic graph.</param>
public sealed record EntityKindMetadata(
    IEntityKind Kind,
    EntityStorageShape StorageShape,
    IReadOnlyList<IEntityKind> AllowedChildKinds)
{
    /// <summary>True when this kind is a file/archive leaf or archive entry.</summary>
    public bool IsLeaf => StorageShape is EntityStorageShape.File or EntityStorageShape.Archive or EntityStorageShape.ArchiveEntry;
}

/// <summary>
/// Code-defined graph metadata for known entity kinds.
/// </summary>
public static class EntityKindMetadataRegistry
{
    private static readonly Lazy<IReadOnlyDictionary<string, EntityKindMetadata>> ItemsByCode = new(CreateItemsByCode);

    /// <summary>All entity-kind metadata entries in deterministic kind-code order.</summary>
    public static IReadOnlyList<EntityKindMetadata> All => ItemsByCode.Value.Values.ToArray();

    /// <summary>
    /// Gets metadata for a registered entity kind.
    /// </summary>
    /// <param name="kind">Entity kind to describe.</param>
    /// <returns>Graph and storage metadata for the supplied kind.</returns>
    public static EntityKindMetadata Require(IEntityKind kind)
    {
        ArgumentNullException.ThrowIfNull(kind);
        if (ItemsByCode.Value.TryGetValue(kind.Code, out var metadata))
        {
            return metadata;
        }

        throw new InvalidOperationException($"Missing entity kind metadata for '{kind.Code}'.");
    }

    private static IReadOnlyDictionary<string, EntityKindMetadata> CreateItemsByCode()
    {
        var items = new[]
        {
            new EntityKindMetadata(EntityKindRegistry.VideoSeries, EntityStorageShape.Folder, [EntityKindRegistry.VideoSeason, EntityKindRegistry.Video]),
            new EntityKindMetadata(EntityKindRegistry.VideoSeason, EntityStorageShape.Folder, [EntityKindRegistry.Video]),
            new EntityKindMetadata(EntityKindRegistry.Video, EntityStorageShape.File, []),
            new EntityKindMetadata(EntityKindRegistry.Gallery, EntityStorageShape.Folder, [EntityKindRegistry.Gallery, EntityKindRegistry.Image]),
            new EntityKindMetadata(EntityKindRegistry.Image, EntityStorageShape.File, []),
            new EntityKindMetadata(EntityKindRegistry.AudioLibrary, EntityStorageShape.Folder, [EntityKindRegistry.AudioLibrary, EntityKindRegistry.AudioTrack]),
            new EntityKindMetadata(EntityKindRegistry.AudioTrack, EntityStorageShape.File, []),
            new EntityKindMetadata(EntityKindRegistry.Audio, EntityStorageShape.File, []),
            new EntityKindMetadata(EntityKindRegistry.Book, EntityStorageShape.Archive, [EntityKindRegistry.BookVolume, EntityKindRegistry.BookChapter, EntityKindRegistry.BookPage]),
            new EntityKindMetadata(EntityKindRegistry.BookVolume, EntityStorageShape.None, [EntityKindRegistry.BookChapter, EntityKindRegistry.BookPage]),
            new EntityKindMetadata(EntityKindRegistry.BookChapter, EntityStorageShape.None, [EntityKindRegistry.BookPage]),
            new EntityKindMetadata(EntityKindRegistry.BookPage, EntityStorageShape.ArchiveEntry, []),
            new EntityKindMetadata(EntityKindRegistry.Person, EntityStorageShape.None, []),
            new EntityKindMetadata(EntityKindRegistry.Studio, EntityStorageShape.None, [EntityKindRegistry.Studio]),
            new EntityKindMetadata(EntityKindRegistry.Tag, EntityStorageShape.None, [EntityKindRegistry.Tag]),
            new EntityKindMetadata(EntityKindRegistry.Collection, EntityStorageShape.None, EntityKindRegistry.All)
        };

        return items
            .OrderBy(item => item.Kind.Code, StringComparer.Ordinal)
            .ToDictionary(item => item.Kind.Code, StringComparer.OrdinalIgnoreCase);
    }
}
