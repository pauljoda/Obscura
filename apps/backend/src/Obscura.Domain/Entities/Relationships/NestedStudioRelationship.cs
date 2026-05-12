namespace Obscura.Domain.Entities;

/// <summary>Relationship from a studio to a nested studio.</summary>
public sealed record NestedStudioRelationship()
    : IEntityRelationship
{
    public string Code => "nested-studio";
    public string DisplayName => "Nested Studio";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.Studio, EntityKindRegistry.Studio, EntityKindRegistry.Studio, this, false, HierarchyOrdering.SortOrder)
    ];
}
