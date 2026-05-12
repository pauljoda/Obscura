namespace Obscura.Domain.Entities;

/// <summary>Relationship from a gallery to a nested gallery entity.</summary>
public sealed record NestedGalleryRelationship()
    : IEntityRelationship
{
    public string Code => "nested-gallery";
    public string DisplayName => "Nested Gallery";
    public bool IsStructural => true;
}
