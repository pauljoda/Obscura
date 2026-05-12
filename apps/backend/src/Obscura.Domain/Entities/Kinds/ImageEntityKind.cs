namespace Obscura.Domain.Entities;

/// <summary>Single image media entity kind.</summary>
public sealed record ImageEntityKind()
    : EntityKind(EntityKindCode.Image, "image", "Image", EntityKindCategory.Media);
