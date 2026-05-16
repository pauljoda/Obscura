using Obscura.Domain.Entities;

namespace Obscura.Domain.Interfaces;

/// <summary>
/// Writes timeline markers for media entities while returning refreshed entity projections.
/// </summary>
public interface IEntityMarkerService
{
    /// <summary>
    /// Adds a timeline marker to an entity.
    /// </summary>
    /// <param name="id">Entity that owns the marker.</param>
    /// <param name="title">Human-readable marker label.</param>
    /// <param name="seconds">Marker start time in seconds.</param>
    /// <param name="endSeconds">Optional marker end time in seconds.</param>
    /// <param name="cancellationToken">Token used to cancel the write.</param>
    /// <returns>The updated entity projection, or null when the entity does not exist.</returns>
    Task<Entity?> CreateMarkerAsync(
        Guid id,
        string title,
        double seconds,
        double? endSeconds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates an existing timeline marker owned by an entity.
    /// </summary>
    /// <param name="id">Entity that owns the marker.</param>
    /// <param name="markerId">Marker to update.</param>
    /// <param name="title">Human-readable marker label.</param>
    /// <param name="seconds">Marker start time in seconds.</param>
    /// <param name="endSeconds">Optional marker end time in seconds.</param>
    /// <param name="cancellationToken">Token used to cancel the write.</param>
    /// <returns>The updated entity projection, or null when the entity does not exist.</returns>
    Task<Entity?> UpdateMarkerAsync(
        Guid id,
        Guid markerId,
        string title,
        double seconds,
        double? endSeconds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Removes an entity-owned timeline marker.
    /// </summary>
    /// <param name="id">Entity that owns the marker.</param>
    /// <param name="markerId">Marker to delete.</param>
    /// <param name="cancellationToken">Token used to cancel the write.</param>
    /// <returns>The updated entity projection, or null when the entity does not exist.</returns>
    Task<Entity?> DeleteMarkerAsync(
        Guid id,
        Guid markerId,
        CancellationToken cancellationToken);
}
