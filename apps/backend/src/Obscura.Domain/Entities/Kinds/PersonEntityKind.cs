namespace Obscura.Domain.Entities;

/// <summary>Person taxonomy entity kind.</summary>
public sealed record PersonEntityKind()
    : IEntityKind
{
    public string Code => "person";
    public string DisplayName => "Person";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => [EntityFileRole.Thumbnail];
}
