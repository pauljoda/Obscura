namespace Obscura.Domain.Entities;

/// <summary>User-curated collection entity kind.</summary>
public sealed record CollectionEntityKind()
    : IEntityKind
{
    public string Code => "collection";
    public string DisplayName => "Collection";
    public EntityKindCategory Category => EntityKindCategory.Collection;
}
