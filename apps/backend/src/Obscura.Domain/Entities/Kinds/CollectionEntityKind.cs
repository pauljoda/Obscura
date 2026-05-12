namespace Obscura.Domain.Entities;

/// <summary>User-curated collection entity kind.</summary>
public sealed record CollectionEntityKind()
    : EntityKind(EntityKindCode.Collection, "collection", "Collection", EntityKindCategory.Collection);
