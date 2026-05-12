namespace Obscura.Domain.Entities;

/// <summary>Relationship from a book to a volume grouping.</summary>
public sealed record VolumeRelationship()
    : IEntityRelationship
{
    public string Code => "volume";
    public string DisplayName => "Volume";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.Book, EntityKindRegistry.Book, EntityKindRegistry.BookVolume, this, false, HierarchyOrdering.SortOrder)
    ];
}
