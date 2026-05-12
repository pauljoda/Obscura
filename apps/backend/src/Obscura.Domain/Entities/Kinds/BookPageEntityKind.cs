namespace Obscura.Domain.Entities;

/// <summary>Book page structural entity kind.</summary>
public sealed record BookPageEntityKind()
    : IEntityKind
{
    public string Code => "book-page";
    public string DisplayName => "Book Page";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Source];
}
