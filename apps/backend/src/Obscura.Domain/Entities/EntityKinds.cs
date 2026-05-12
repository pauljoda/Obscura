namespace Obscura.Domain.Entities;

/// <summary>
/// Central registry for the entity kinds that the v2 backend understands.
/// </summary>
public static class EntityKinds
{
    private static readonly EntityKind[] Known =
    [
        new("video", "Video", EntityKindCategory.Media),
        new("video-series", "Video Series", EntityKindCategory.Media),
        new("image", "Image", EntityKindCategory.Media),
        new("gallery", "Gallery", EntityKindCategory.Media),
        new("book", "Book", EntityKindCategory.Media),
        new("audio", "Audio", EntityKindCategory.Media),
        new("audio-library", "Audio Library", EntityKindCategory.Media),
        new("audio-track", "Audio Track", EntityKindCategory.Media),
        new("performer", "Performer", EntityKindCategory.Taxonomy),
        new("studio", "Studio", EntityKindCategory.Taxonomy),
        new("tag", "Tag", EntityKindCategory.Taxonomy),
        new("collection", "Collection", EntityKindCategory.Collection)
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
}
