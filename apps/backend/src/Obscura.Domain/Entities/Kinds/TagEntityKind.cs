namespace Obscura.Domain.Entities;

/// <summary>Tag taxonomy entity kind.</summary>
public sealed record TagEntityKind()
    : EntityKind(EntityKindCode.Tag, "tag", "Tag", EntityKindCategory.Taxonomy);
