namespace Obscura.Domain.Entities;

/// <summary>Studio taxonomy entity kind.</summary>
public sealed record StudioEntityKind()
    : EntityKind(EntityKindCode.Studio, "studio", "Studio", EntityKindCategory.Taxonomy);
