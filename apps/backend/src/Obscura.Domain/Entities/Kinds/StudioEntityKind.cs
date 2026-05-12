namespace Obscura.Domain.Entities;

/// <summary>Studio taxonomy entity kind.</summary>
public sealed record StudioEntityKind()
    : IEntityKind
{
    public string Code => "studio";
    public string DisplayName => "Studio";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Logo
    ];
}
