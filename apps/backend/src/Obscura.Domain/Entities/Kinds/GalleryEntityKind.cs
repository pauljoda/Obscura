namespace Obscura.Domain.Entities;

/// <summary>Image gallery entity kind.</summary>
public sealed record GalleryEntityKind()
    : EntityKind(EntityKindCode.Gallery, "gallery", "Gallery", EntityKindCategory.Media);
