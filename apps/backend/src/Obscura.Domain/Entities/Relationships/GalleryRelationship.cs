namespace Obscura.Domain.Entities;

/// <summary>Relationship from a gallery to another gallery or image child.</summary>
public sealed record GalleryRelationship()
    : IEntityRelationship
{
    public string Code => "gallery";
    public string DisplayName => "Gallery";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.Gallery, EntityKindRegistry.Gallery, EntityKindRegistry.Gallery, this, false, HierarchyOrdering.SortOrder),
        new(EntityKindRegistry.Gallery, EntityKindRegistry.Gallery, EntityKindRegistry.Image, this, false, HierarchyOrdering.SortOrder)
    ];
}
