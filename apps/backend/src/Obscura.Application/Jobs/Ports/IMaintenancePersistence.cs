using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Ports;

/// <summary>
/// Port for library maintenance operations — querying entity IDs for cache validation
/// and cleaning up orphaned cache entries.
/// </summary>
public interface IMaintenancePersistence
{
    /// <summary>
    /// Returns all non-deleted entity IDs for the given entity kind.
    /// </summary>
    Task<IReadOnlyList<Guid>> GetActiveEntityIdsByKindAsync(IEntityKind kind, CancellationToken cancellationToken);

    /// <summary>
    /// Returns the base cache directory path (e.g. /data/cache).
    /// </summary>
    string GetCacheBasePath();
}
