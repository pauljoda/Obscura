using Obscura.Domain.Entities;

namespace Obscura.Domain.Interfaces;

/// <summary>
/// Reads and validates structural entity hierarchy without exposing persistence details.
/// </summary>
public interface IEntityHierarchy
{
    /// <summary>
    /// Lists child entities linked from a parent through a named relationship.
    /// </summary>
    /// <param name="parentId">Parent entity identifier.</param>
    /// <param name="relationship">Typed relationship to traverse.</param>
    /// <param name="childKind">Optional typed child kind filter.</param>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>Child entities in relationship order.</returns>
    Task<IReadOnlyList<Entity>> ListChildrenAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken);

    /// <summary>
    /// Loads an ordered entity tree for a root using a registered hierarchy definition.
    /// </summary>
    /// <param name="rootId">Root entity identifier.</param>
    /// <param name="definition">Hierarchy definition that describes allowed child layers.</param>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>The projected hierarchy tree, or null when the root is missing or has the wrong kind.</returns>
    Task<EntityHierarchyTree?> GetTreeAsync(
        Guid rootId,
        HierarchyDefinition definition,
        CancellationToken cancellationToken);

    /// <summary>
    /// Determines whether a parent and child kind may be connected through a relationship.
    /// </summary>
    /// <param name="parentKind">Parent entity kind.</param>
    /// <param name="childKind">Child entity kind.</param>
    /// <param name="relationship">Relationship between parent and child.</param>
    /// <returns>True when the edge is allowed by a registered hierarchy definition.</returns>
    bool IsAllowed(IEntityKind parentKind, IEntityKind childKind, IEntityRelationship relationship);
}
