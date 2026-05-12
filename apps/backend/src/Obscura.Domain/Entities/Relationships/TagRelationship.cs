namespace Obscura.Domain.Entities;

/// <summary>Relationship from a tag to another tag.</summary>
public sealed record TagRelationship()
    : IEntityRelationship
{
    public string Code => "tag";
    public string DisplayName => "Tag";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.Tag, EntityKindRegistry.Tag, EntityKindRegistry.Tag, this, false, HierarchyOrdering.SortOrder)
    ];
}
