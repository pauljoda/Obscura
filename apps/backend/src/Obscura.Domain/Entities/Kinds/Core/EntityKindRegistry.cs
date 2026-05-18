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
/// Boundary descriptor for mapping domain entity kinds to stable storage codes.
/// </summary>
/// <param name="Value">Domain enum value.</param>
/// <param name="Code">Stable database/API code.</param>
/// <param name="DisplayName">Human-readable display name.</param>
/// <param name="Category">Broad category used by metadata rows.</param>
public sealed record EntityKindDescriptor(
    EntityKind Value,
    string Code,
    string DisplayName,
    EntityKindCategory Category) {
    /// <summary>Allows boundary descriptors to flow into domain-only metadata APIs.</summary>
    public static implicit operator EntityKind(EntityKindDescriptor descriptor) => descriptor.Value;
}

/// <summary>
/// Stable boundary mapping between domain entity kind enums and persisted string codes.
/// </summary>
public static class EntityKindRegistry {
    public static readonly EntityKindDescriptor Audio = new(EntityKind.Audio, "audio", "Audio", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor AudioLibrary = new(EntityKind.AudioLibrary, "audio-library", "Audio Library", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor AudioTrack = new(EntityKind.AudioTrack, "audio-track", "Audio Track", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor Book = new(EntityKind.Book, "book", "Book", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor BookVolume = new(EntityKind.BookVolume, "book-volume", "Book Volume", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor BookChapter = new(EntityKind.BookChapter, "book-chapter", "Book Chapter", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor BookPage = new(EntityKind.BookPage, "book-page", "Book Page", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor Collection = new(EntityKind.Collection, "collection", "Collection", EntityKindCategory.Collection);
    public static readonly EntityKindDescriptor Gallery = new(EntityKind.Gallery, "gallery", "Gallery", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor Image = new(EntityKind.Image, "image", "Image", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor Person = new(EntityKind.Person, "person", "Person", EntityKindCategory.Taxonomy);
    public static readonly EntityKindDescriptor Studio = new(EntityKind.Studio, "studio", "Studio", EntityKindCategory.Taxonomy);
    public static readonly EntityKindDescriptor Tag = new(EntityKind.Tag, "tag", "Tag", EntityKindCategory.Taxonomy);
    public static readonly EntityKindDescriptor Video = new(EntityKind.Video, "video", "Video", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor VideoSeries = new(EntityKind.VideoSeries, "video-series", "Video Series", EntityKindCategory.Media);
    public static readonly EntityKindDescriptor VideoSeason = new(EntityKind.VideoSeason, "video-season", "Video Season", EntityKindCategory.Media);

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

    /// <summary>All known entity kind descriptors.</summary>
    public static IReadOnlyList<EntityKindDescriptor> All { get; } = ByKind.Values.ToArray();

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
