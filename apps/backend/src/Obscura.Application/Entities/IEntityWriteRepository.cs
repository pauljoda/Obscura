using Obscura.Domain.Entities;

namespace Obscura.Application.Entities;

/// <summary>
/// Application port that loads a hydrated domain <see cref="Entity"/> for mutation and
/// persists it back. The implementation lives in Infrastructure (EF Core) and owns the
/// row-to-domain hydration and unit-of-work boundary.
/// </summary>
public interface IEntityWriteRepository {
    /// <summary>
    /// Finds an active entity and hydrates its domain relationships plus mutable state capabilities.
    /// Returns null when no active entity exists for the given identifier.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task<Entity?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Persists one hydrated domain entity slice, including structural links, relationships,
    /// and mutable capabilities. Commits as a single unit of work.
    /// </summary>
    /// <param name="entity">Entity to persist.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SaveAsync(Entity entity, CancellationToken cancellationToken);
}
