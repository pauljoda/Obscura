namespace Obscura.Domain.Entities;

/// <summary>
/// Broad grouping used to separate media, taxonomy, collection, and system entities.
/// </summary>
public enum EntityKindCategory
{
    /// <summary>Playable, readable, or viewable library items.</summary>
    Media,

    /// <summary>Descriptive classification entities such as performers, studios, and tags.</summary>
    Taxonomy,

    /// <summary>User-curated groupings of other entities.</summary>
    Collection,

    /// <summary>Internal entities that support app behavior rather than library browsing.</summary>
    System
}

/// <summary>
/// Describes a known entity kind without coupling domain code to route names or database rows.
/// </summary>
/// <param name="Code">Stable code used in storage, URLs, and API filters.</param>
/// <param name="DisplayName">Human-readable label for diagnostics and future UI surfaces.</param>
/// <param name="Category">Broad category used for behavior grouping.</param>
public sealed record EntityKind(string Code, string DisplayName, EntityKindCategory Category);
