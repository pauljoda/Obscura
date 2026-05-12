namespace Obscura.Domain.Entities;

/// <summary>Relationship from a gallery to a nested gallery entity.</summary>
public sealed record NestedGalleryRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.NestedGallery;
    public string Code => "gallery";
    public string DisplayName => "Nested Gallery";
    public bool IsStructural => true;
}
