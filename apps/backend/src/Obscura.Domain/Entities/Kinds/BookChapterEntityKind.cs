namespace Obscura.Domain.Entities;

/// <summary>Book chapter structural entity kind.</summary>
public sealed record BookChapterEntityKind()
    : IEntityKind
{
    public string Code => "book-chapter";
    public string DisplayName => "Book Chapter";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Cover
    ];
}
