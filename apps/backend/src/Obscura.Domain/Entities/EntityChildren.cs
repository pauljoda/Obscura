namespace Obscura.Domain.Entities;

/// <summary>
/// Semantic role for a structural child relationship.
/// </summary>
public enum ChildRole {
    /// <summary>Normal parent-child structure.</summary>
    Structural
}

/// <summary>
/// Relationship from one entity to a structural child entity.
/// </summary>
/// <param name="Entity">Child entity instance.</param>
/// <param name="Role">Semantic child role.</param>
/// <param name="SortOrder">Optional display order.</param>
public sealed record EntityChild(Entity Entity, ChildRole Role = ChildRole.Structural, int? SortOrder = null);
