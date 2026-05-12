namespace Obscura.Domain.Entities;

/// <summary>
/// Broad grouping used to separate media, taxonomy, collection, and system entities.
/// </summary>
public enum EntityKindCategory
{
    /// <summary>Playable, readable, or viewable library items.</summary>
    Media,

    /// <summary>Descriptive classification entities such as people, studios, and tags.</summary>
    Taxonomy,

    /// <summary>User-curated groupings of other entities.</summary>
    Collection,

    /// <summary>Internal entities that support app behavior rather than library browsing.</summary>
    System
}
