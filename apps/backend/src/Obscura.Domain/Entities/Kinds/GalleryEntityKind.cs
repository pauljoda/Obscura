namespace Obscura.Domain.Entities;

/// <summary>Image gallery entity kind.</summary>
public sealed record GalleryEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.Gallery;
    public string Code => "gallery";
    public string DisplayName => "Gallery";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
