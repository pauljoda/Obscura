namespace Obscura.Domain.Entities;

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
        new("performer", "Performer", EntityKindCategory.Taxonomy),
        new("studio", "Studio", EntityKindCategory.Taxonomy),
        new("tag", "Tag", EntityKindCategory.Taxonomy),
        new("collection", "Collection", EntityKindCategory.Collection)
    ];

    private static readonly IReadOnlyDictionary<string, EntityKind> ByCode = Known.ToDictionary(
        kind => kind.Code,
        StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<EntityKind> All => Known;

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
