namespace Obscura.Domain.Entities;

public enum EntityKindCategory
{
    Media,
    Taxonomy,
    Collection,
    System
}

public sealed record EntityKind(string Code, string DisplayName, EntityKindCategory Category);
