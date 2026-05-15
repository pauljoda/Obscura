using Obscura.Domain.Entities;

namespace Obscura.Domain.Interfaces;

/// <summary>
/// Writes shared rating and flag capabilities for any entity kind.
/// </summary>
public interface IRatingService
{
    /// <summary>
    /// Sets or clears an entity rating.
    /// </summary>
    /// <param name="id">Entity being rated.</param>
    /// <param name="value">Rating value to set, or null to remove the rating.</param>
    /// <param name="cancellationToken">Token used to cancel the write.</param>
    /// <returns>The updated entity projection, or null when the entity does not exist.</returns>
    Task<Entity?> UpdateRatingAsync(
        Guid id,
        int? value,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates any supplied entity flags while leaving omitted flags unchanged.
    /// </summary>
    /// <param name="id">Entity whose flags should be updated.</param>
    /// <param name="isFavorite">Optional favorite flag value.</param>
    /// <param name="isNsfw">Optional NSFW flag value.</param>
    /// <param name="isOrganized">Optional organized/reviewed flag value.</param>
    /// <param name="cancellationToken">Token used to cancel the write.</param>
    /// <returns>The updated entity projection, or null when the entity does not exist.</returns>
    Task<Entity?> UpdateFlagsAsync(
        Guid id,
        bool? isFavorite,
        bool? isNsfw,
        bool? isOrganized,
        CancellationToken cancellationToken);

    /// <summary>
    /// Updates playback state for a media entity.
    /// Increments play count on the first call for an entity that has no existing playback row,
    /// updates resume position and accumulated duration, and optionally records completion.
    /// </summary>
    /// <param name="id">Entity whose playback state should be updated.</param>
    /// <param name="resumeSeconds">Resume position in seconds, or null to leave unchanged.</param>
    /// <param name="durationSeconds">Seconds of playback to add to the accumulated total, or null to skip.</param>
    /// <param name="completed">When true marks the entity as completed now; when false clears completion; null leaves unchanged.</param>
    /// <param name="cancellationToken">Token used to cancel the write.</param>
    /// <returns>The updated entity projection, or null when the entity does not exist.</returns>
    Task<Entity?> UpdatePlaybackAsync(
        Guid id,
        double? resumeSeconds,
        double? durationSeconds,
        bool? completed,
        CancellationToken cancellationToken);
}
