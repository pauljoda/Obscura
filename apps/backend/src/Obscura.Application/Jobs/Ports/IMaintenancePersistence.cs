namespace Obscura.Application.Jobs.Ports;

/// <summary>
/// Port for library maintenance operations — querying entity IDs for cache validation
/// and cleaning up orphaned cache entries.
/// </summary>
public interface IMaintenancePersistence
{
    /// <summary>
    /// Returns all non-deleted entity IDs for a given kind code (e.g. "video", "image", "audio-track", "book-page").
    /// </summary>
    Task<IReadOnlyList<Guid>> GetActiveEntityIdsByKindAsync(string kindCode, CancellationToken cancellationToken);

    /// <summary>
    /// Returns the base cache directory path (e.g. /data/cache).
    /// </summary>
    string GetCacheBasePath();
}
