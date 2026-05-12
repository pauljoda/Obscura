using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Application.Entities;

/// <summary>
/// Application use-case service for generic entity browsing and shared entity capability writes.
/// </summary>
public sealed class EntityService
{
    private readonly IEntityCatalog _entities;
    private readonly IRatingService _ratings;

    /// <summary>
    /// Creates an entity service over read and write domain ports.
    /// </summary>
    /// <param name="entities">Catalog used for entity read projections.</param>
    /// <param name="ratings">Capability writer used for rating and flag changes.</param>
    public EntityService(IEntityCatalog entities, IRatingService ratings)
    {
        _entities = entities;
        _ratings = ratings;
    }

    /// <summary>
    /// Lists entities using application query language instead of API request DTOs.
    /// </summary>
    /// <param name="query">Entity list filters and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A page of domain entities.</returns>
    public Task<EntityPage> ListAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        _entities.ListAsync(query.Kind, query.Search, query.Cursor, cancellationToken);

    /// <summary>
    /// Gets one entity by global identifier.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The entity projection, or null when it is missing.</returns>
    public Task<Entity?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        _entities.GetAsync(id, cancellationToken);

    /// <summary>
    /// Lists related child entities for use cases that need hierarchy or membership expansion.
    /// </summary>
    /// <param name="parentId">Parent entity identifier.</param>
    /// <param name="relationship">Typed relationship to traverse.</param>
    /// <param name="childKind">Optional typed child kind filter.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Child entities in relationship order.</returns>
    public Task<IReadOnlyList<Entity>> ListChildrenAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken) =>
        _entities.ListChildrenAsync(parentId, relationship, childKind, cancellationToken);

    /// <summary>
    /// Applies a rating command and returns the updated entity projection.
    /// </summary>
    /// <param name="command">Rating command from the application boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The updated entity, or null when the entity is missing.</returns>
    public Task<Entity?> SetRatingAsync(SetEntityRatingCommand command, CancellationToken cancellationToken) =>
        _ratings.UpdateRatingAsync(command.EntityId, command.Value, cancellationToken);

    /// <summary>
    /// Applies a partial flag update and returns the updated entity projection.
    /// </summary>
    /// <param name="command">Flag update command from the application boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The updated entity, or null when the entity is missing.</returns>
    public Task<Entity?> UpdateFlagsAsync(UpdateEntityFlagsCommand command, CancellationToken cancellationToken) =>
        _ratings.UpdateFlagsAsync(
            command.EntityId,
            command.IsFavorite,
            command.IsNsfw,
            command.IsOrganized,
            cancellationToken);
}
