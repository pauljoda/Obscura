namespace Obscura.Domain.Entities;

/// <summary>Relationship from a gallery to one of its image entities.</summary>
public sealed record GalleryImageRelationship()
    : EntityRelationship(EntityRelationshipCode.GalleryImage, "image", "Gallery Image", true);
