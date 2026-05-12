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
}
