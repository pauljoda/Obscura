using Obscura.Domain.Entities;

namespace Obscura.Domain.Interfaces;

/// <summary>
/// Reads global entities and entity relationships without exposing storage or API contract details.
/// </summary>
public interface IEntityCatalog
{
    /// <summary>
    /// Lists visible entities, optionally filtered by kind, search text, and cursor.
    /// </summary>
    /// <param name="kind">Optional typed entity kind to restrict the list.</param>
    /// <param name="query">Optional case-insensitive title search.</param>
    /// <param name="cursor">Opaque cursor from a previous page.</param>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>A page of projected domain entities.</returns>
    Task<EntityPage> ListAsync(
        EntityKind? kind,
        string? query,
        string? cursor,
        CancellationToken cancellationToken);

    /// <summary>
    /// Gets one visible entity by its global identifier.
    /// </summary>
    /// <param name="id">Global entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>The projected entity, or null when it is missing or deleted.</returns>
    Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken);

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
        EntityRelationship relationship,
        EntityKind? childKind,
        CancellationToken cancellationToken);
}
