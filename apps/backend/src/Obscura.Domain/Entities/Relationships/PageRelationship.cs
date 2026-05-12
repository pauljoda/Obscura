namespace Obscura.Domain.Entities;

/// <summary>Relationship from a chapter to a readable page.</summary>
public sealed record PageRelationship()
    : IEntityRelationship
{
    public string Code => "page";
    public string DisplayName => "Page";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.Book, EntityKindRegistry.BookChapter, EntityKindRegistry.BookPage, this, false, HierarchyOrdering.SortOrder)
    ];
}
