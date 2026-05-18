using Obscura.Domain.Entities;

namespace Obscura.Application.Entities;

/// <summary>
/// Application persistence port for loading and saving domain entities without exposing EF rows or API contracts.
/// </summary>
public interface EntityRepository {
    /// <summary>
    /// Finds an entity by identifier.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The hydrated domain entity, or null when no active entity exists.</returns>
    Task<Entity?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Finds an entity by identifier and concrete domain type.
    /// </summary>
    /// <typeparam name="TEntity">Expected concrete entity type.</typeparam>
    /// <param name="id">Entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The hydrated entity, or null when missing or not of the requested type.</returns>
    Task<TEntity?> FindAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity;

    /// <summary>
    /// Finds a required entity by identifier and concrete domain type.
    /// </summary>
    /// <typeparam name="TEntity">Expected concrete entity type.</typeparam>
    /// <param name="id">Entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The hydrated entity.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the entity is missing or not of the requested type.</exception>
    Task<TEntity> RequireAsync<TEntity>(Guid id, CancellationToken cancellationToken)
        where TEntity : Entity;

    /// <summary>
    /// Saves one hydrated entity slice as the current application transaction boundary.
    /// </summary>
    /// <param name="entity">Domain entity to persist.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SaveAsync(Entity entity, CancellationToken cancellationToken);
}
