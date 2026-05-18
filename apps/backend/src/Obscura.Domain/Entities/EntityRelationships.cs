namespace Obscura.Domain.Entities;

/// <summary>
/// Domain role for a non-structural relationship.
/// </summary>
public enum RelationshipRole {
    /// <summary>Related person, tag, studio, or other reference.</summary>
    Related,

    /// <summary>Credited person or organization.</summary>
    Credit,

    /// <summary>Tag relationship.</summary>
    Tag,

    /// <summary>Studio, publisher, label, or production group relationship.</summary>
    Studio
}

/// <summary>
/// Non-structural relationship from one entity to another entity.
/// </summary>
/// <param name="Entity">Related entity instance.</param>
/// <param name="Role">Semantic relationship role.</param>
/// <param name="SortOrder">Optional display order.</param>
public sealed record EntityRelationship(Entity Entity, RelationshipRole Role, int? SortOrder = null);
