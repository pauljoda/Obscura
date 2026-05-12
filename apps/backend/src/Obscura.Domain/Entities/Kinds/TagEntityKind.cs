namespace Obscura.Domain.Entities;

/// <summary>Tag taxonomy entity kind.</summary>
public sealed record TagEntityKind()
    : IEntityKind
{
    public string Code => "tag";
    public string DisplayName => "Tag";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Thumbnail];
}
