namespace Obscura.Domain.Entities;

/// <summary>Book, comic, or manga entity kind.</summary>
public sealed record BookEntityKind()
    : IEntityKind
{
    public string Code => "book";
    public string DisplayName => "Book";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Cover
    ];
}
