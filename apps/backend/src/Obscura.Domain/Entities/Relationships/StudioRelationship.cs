namespace Obscura.Domain.Entities;

/// <summary>Relationship from a studio to another studio.</summary>
public sealed record StudioRelationship()
    : IEntityRelationship
{
    public string Code => "studio";
    public string DisplayName => "Studio";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.Studio, EntityKindRegistry.Studio, EntityKindRegistry.Studio, this, false, HierarchyOrdering.SortOrder)
    ];
}
