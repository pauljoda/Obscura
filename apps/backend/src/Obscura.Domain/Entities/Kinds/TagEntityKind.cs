namespace Obscura.Domain.Entities;

/// <summary>Tag taxonomy entity kind.</summary>
public sealed record TagEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.Tag;
    public string Code => "tag";
    public string DisplayName => "Tag";
    public EntityKindCategory Category => EntityKindCategory.Taxonomy;
}
