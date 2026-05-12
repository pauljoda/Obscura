namespace Obscura.Domain.Entities;

/// <summary>Person taxonomy entity kind.</summary>
public sealed record PersonEntityKind()
    : EntityKind(EntityKindCode.Person, "person", "Person", EntityKindCategory.Taxonomy);
