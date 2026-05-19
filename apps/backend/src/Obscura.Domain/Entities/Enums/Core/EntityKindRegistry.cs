namespace Obscura.Domain.Entities;

/// <summary>
/// Broad category for an entity kind when infrastructure needs seed metadata.
/// </summary>
public enum EntityKindCategory {
    /// <summary>Playable or viewable media.</summary>
    Media,

    /// <summary>Taxonomy or organization entity.</summary>
    Taxonomy,

    /// <summary>User-curated grouping entity.</summary>
    Collection
}

/// <summary>
/// Single source of truth describing an entity kind: its stable code, display name,
/// category, filesystem storage shape, and concrete domain CLR type (when one exists).
/// </summary>
/// <param name="Value">Domain enum value.</param>
/// <param name="Code">Stable database/API code.</param>
/// <param name="DisplayName">Human-readable display name.</param>
/// <param name="Category">Broad category used by metadata rows.</param>
/// <param name="StorageShape">Filesystem storage shape used by scan and organize rules.</param>
/// <param name="ClrType">Concrete domain entity type, or null for kinds with no concrete type.</param>
public sealed record EntityKindDescriptor(
    EntityKind Value,
    string Code,
    string DisplayName,
    EntityKindCategory Category,
    EntityStorageShape StorageShape,
    Type? ClrType) {
    /// <summary>Allows boundary descriptors to flow into domain-only metadata APIs.</summary>
    public static implicit operator EntityKind(EntityKindDescriptor descriptor) => descriptor.Value;
}

/// <summary>
/// The single registry mapping domain entity kinds to their stable code, CLR type, and
/// storage shape. There is intentionally no parallel type catalog or metadata registry;
/// every kind fact lives here.
/// </summary>
public static class EntityKindRegistry {
    public static readonly EntityKindDescriptor Audio = new(EntityKind.Audio, "audio", "Audio", EntityKindCategory.Media, EntityStorageShape.File, null);
    public static readonly EntityKindDescriptor AudioLibrary = new(EntityKind.AudioLibrary, "audio-library", "Audio Library", EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.AudioLibrary));
    public static readonly EntityKindDescriptor AudioTrack = new(EntityKind.AudioTrack, "audio-track", "Audio Track", EntityKindCategory.Media, EntityStorageShape.File, typeof(Obscura.Domain.Media.AudioTrack));
    public static readonly EntityKindDescriptor Book = new(EntityKind.Book, "book", "Book", EntityKindCategory.Media, EntityStorageShape.Archive, typeof(Obscura.Domain.Media.Book));
    public static readonly EntityKindDescriptor BookVolume = new(EntityKind.BookVolume, "book-volume", "Book Volume", EntityKindCategory.Media, EntityStorageShape.None, typeof(Obscura.Domain.Media.BookVolume));
    public static readonly EntityKindDescriptor BookChapter = new(EntityKind.BookChapter, "book-chapter", "Book Chapter", EntityKindCategory.Media, EntityStorageShape.None, typeof(Obscura.Domain.Media.BookChapter));
    public static readonly EntityKindDescriptor BookPage = new(EntityKind.BookPage, "book-page", "Book Page", EntityKindCategory.Media, EntityStorageShape.ArchiveEntry, typeof(Obscura.Domain.Media.BookPage));
    public static readonly EntityKindDescriptor Collection = new(EntityKind.Collection, "collection", "Collection", EntityKindCategory.Collection, EntityStorageShape.None, typeof(Obscura.Domain.Media.Collection));
    public static readonly EntityKindDescriptor Gallery = new(EntityKind.Gallery, "gallery", "Gallery", EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.Gallery));
    public static readonly EntityKindDescriptor Image = new(EntityKind.Image, "image", "Image", EntityKindCategory.Media, EntityStorageShape.File, typeof(Obscura.Domain.Media.Image));
    public static readonly EntityKindDescriptor Person = new(EntityKind.Person, "person", "Person", EntityKindCategory.Taxonomy, EntityStorageShape.None, typeof(Obscura.Domain.Taxonomy.Person));
    public static readonly EntityKindDescriptor Studio = new(EntityKind.Studio, "studio", "Studio", EntityKindCategory.Taxonomy, EntityStorageShape.None, typeof(Obscura.Domain.Taxonomy.Studio));
    public static readonly EntityKindDescriptor Tag = new(EntityKind.Tag, "tag", "Tag", EntityKindCategory.Taxonomy, EntityStorageShape.None, typeof(Obscura.Domain.Taxonomy.Tag));
    public static readonly EntityKindDescriptor Video = new(EntityKind.Video, "video", "Video", EntityKindCategory.Media, EntityStorageShape.File, typeof(Obscura.Domain.Media.Video));
    public static readonly EntityKindDescriptor VideoSeries = new(EntityKind.VideoSeries, "video-series", "Video Series", EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.VideoSeries));
    public static readonly EntityKindDescriptor VideoSeason = new(EntityKind.VideoSeason, "video-season", "Video Season", EntityKindCategory.Media, EntityStorageShape.Folder, typeof(Obscura.Domain.Media.VideoSeason));

    private static readonly IReadOnlyDictionary<EntityKind, EntityKindDescriptor> ByKind = new Dictionary<EntityKind, EntityKindDescriptor> {
        [EntityKind.Audio] = Audio,
        [EntityKind.AudioLibrary] = AudioLibrary,
        [EntityKind.AudioTrack] = AudioTrack,
        [EntityKind.Book] = Book,
        [EntityKind.BookVolume] = BookVolume,
        [EntityKind.BookChapter] = BookChapter,
        [EntityKind.BookPage] = BookPage,
        [EntityKind.Collection] = Collection,
        [EntityKind.Gallery] = Gallery,
        [EntityKind.Image] = Image,
        [EntityKind.Person] = Person,
        [EntityKind.Studio] = Studio,
        [EntityKind.Tag] = Tag,
        [EntityKind.Video] = Video,
        [EntityKind.VideoSeries] = VideoSeries,
        [EntityKind.VideoSeason] = VideoSeason
    };

    private static readonly IReadOnlyDictionary<string, EntityKindDescriptor> ByCode = ByKind.Values
        .ToDictionary(descriptor => descriptor.Code, StringComparer.OrdinalIgnoreCase);

    private static readonly IReadOnlyDictionary<Type, EntityKindDescriptor> ByType = ByKind.Values
        .Where(descriptor => descriptor.ClrType is not null)
        .ToDictionary(descriptor => descriptor.ClrType!);

    /// <summary>All known entity kind descriptors.</summary>
    public static IReadOnlyList<EntityKindDescriptor> All { get; } = ByKind.Values.ToArray();

    /// <summary>
    /// Gets the full descriptor for a domain entity kind.
    /// </summary>
    /// <param name="kind">Domain entity kind.</param>
    /// <returns>The descriptor for the kind.</returns>
    public static EntityKindDescriptor Describe(EntityKind kind) => ByKind[kind];

    /// <summary>
    /// Encodes a domain entity kind to its stable storage code.
    /// </summary>
    /// <param name="kind">Domain entity kind.</param>
    /// <returns>Stable storage code.</returns>
    public static string ToCode(EntityKind kind) => ByKind[kind].Code;

    /// <summary>
    /// Decodes a storage code to a domain entity kind.
    /// </summary>
    /// <param name="code">Storage code.</param>
    /// <returns>Domain entity kind.</returns>
    public static EntityKind Require(string code) =>
        TryGet(code, out var kind)
            ? kind
            : throw new InvalidOperationException($"Unknown entity kind code '{code}'.");

    /// <summary>
    /// Gets the entity kind represented by a concrete domain entity CLR type.
    /// </summary>
    /// <param name="entityType">Concrete entity CLR type.</param>
    /// <returns>The entity kind represented by the type.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the type is not a registered concrete entity.</exception>
    public static EntityKind RequireType(Type entityType) {
        ArgumentNullException.ThrowIfNull(entityType);
        return ByType.TryGetValue(entityType, out var descriptor)
            ? descriptor.Value
            : throw new InvalidOperationException($"Entity type '{entityType.Name}' is not registered.");
    }

    /// <summary>
    /// Attempts to decode a storage code to a domain entity kind.
    /// </summary>
    /// <param name="code">Storage code.</param>
    /// <param name="kind">Decoded entity kind when successful.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string code, out EntityKind kind) {
        if (ByCode.TryGetValue(code, out var descriptor)) {
            kind = descriptor.Value;
            return true;
        }

        kind = default;
        return false;
    }
}
