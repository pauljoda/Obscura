namespace Obscura.Domain.Entities;

/// <summary>
/// Central registry for the entity kinds that the v2 backend understands.
/// </summary>
public static class EntityKinds
{
    /// <summary>Known video entity kind.</summary>
    public static readonly EntityKind Video = new(EntityKindCode.Video, "video", "Video", EntityKindCategory.Media);

    /// <summary>Known video series entity kind.</summary>
    public static readonly EntityKind VideoSeries = new(EntityKindCode.VideoSeries, "video-series", "Video Series", EntityKindCategory.Media);

    /// <summary>Known image entity kind.</summary>
    public static readonly EntityKind Image = new(EntityKindCode.Image, "image", "Image", EntityKindCategory.Media);

    /// <summary>Known gallery entity kind.</summary>
    public static readonly EntityKind Gallery = new(EntityKindCode.Gallery, "gallery", "Gallery", EntityKindCategory.Media);

    /// <summary>Known book entity kind.</summary>
    public static readonly EntityKind Book = new(EntityKindCode.Book, "book", "Book", EntityKindCategory.Media);

    /// <summary>Known generic audio entity kind.</summary>
    public static readonly EntityKind Audio = new(EntityKindCode.Audio, "audio", "Audio", EntityKindCategory.Media);

    /// <summary>Known audio library entity kind.</summary>
    public static readonly EntityKind AudioLibrary = new(EntityKindCode.AudioLibrary, "audio-library", "Audio Library", EntityKindCategory.Media);

    /// <summary>Known audio track entity kind.</summary>
    public static readonly EntityKind AudioTrack = new(EntityKindCode.AudioTrack, "audio-track", "Audio Track", EntityKindCategory.Media);

    /// <summary>Known person taxonomy entity kind.</summary>
    public static readonly EntityKind Person = new(EntityKindCode.Person, "person", "Person", EntityKindCategory.Taxonomy);

    /// <summary>Known studio taxonomy entity kind.</summary>
    public static readonly EntityKind Studio = new(EntityKindCode.Studio, "studio", "Studio", EntityKindCategory.Taxonomy);

    /// <summary>Known tag taxonomy entity kind.</summary>
    public static readonly EntityKind Tag = new(EntityKindCode.Tag, "tag", "Tag", EntityKindCategory.Taxonomy);

    /// <summary>Known collection entity kind.</summary>
    public static readonly EntityKind Collection = new(EntityKindCode.Collection, "collection", "Collection", EntityKindCategory.Collection);

    private static readonly EntityKind[] Known =
    [
        Video,
        VideoSeries,
        Image,
        Gallery,
        Book,
        Audio,
        AudioLibrary,
        AudioTrack,
        Person,
        Studio,
        Tag,
        Collection
    ];

    private static readonly IReadOnlyDictionary<string, EntityKind> ByCode = Known.ToDictionary(
        kind => kind.Code,
        StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Gets every known entity kind in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<EntityKind> All => Known;

    /// <summary>
    /// Looks up an entity kind by its stable code.
    /// </summary>
    /// <param name="code">Kind code from storage, a route, or an API filter.</param>
    /// <param name="kind">The matched kind when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out EntityKind kind)
    {
        if (code is not null && ByCode.TryGetValue(code, out var match))
        {
            kind = match;
            return true;
        }

        kind = default!;
        return false;
    }

    /// <summary>
    /// Looks up an entity kind by its stable code and fails when storage contains an unknown kind.
    /// </summary>
    /// <param name="code">Kind code from storage.</param>
    /// <returns>The registered entity kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the kind code is not registered.</exception>
    public static EntityKind Require(string code)
    {
        if (TryGet(code, out var kind))
        {
            return kind;
        }

        throw new InvalidOperationException($"Unknown entity kind code '{code}'. Add it to {nameof(EntityKinds)} before using it.");
    }
}
