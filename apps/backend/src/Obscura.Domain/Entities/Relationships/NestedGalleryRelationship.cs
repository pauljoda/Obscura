namespace Obscura.Domain.Entities;

/// <summary>Relationship from a gallery to a nested gallery entity.</summary>
public sealed record NestedGalleryRelationship()
    : EntityRelationship(EntityRelationshipCode.NestedGallery, "gallery", "Nested Gallery", true);
