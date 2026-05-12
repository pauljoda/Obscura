namespace Obscura.Domain.Entities;

/// <summary>Relationship from a gallery to one of its image entities.</summary>
public sealed record GalleryImageRelationship()
    : IEntityRelationship
{
    public string Code => "gallery-image";
    public string DisplayName => "Gallery Image";
    public bool IsStructural => true;
}
