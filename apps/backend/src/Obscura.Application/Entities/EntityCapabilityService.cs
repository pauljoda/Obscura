using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Application.Entities;

/// <summary>
/// Application use-case service for mutating an entity's user-state capabilities
/// (rating, flags, playback position, markers). Encapsulates the load → mutate → save
/// orchestration so endpoints stay thin and the domain methods remain the single source
/// of behavioral truth.
///
/// Returns the hydrated <see cref="Entity"/> on success so callers can project it to a
/// response contract, or <c>null</c> when no active entity exists for the identifier.
/// </summary>
public sealed class EntityCapabilityService
{
    private readonly IEntityWriteRepository _entities;

    /// <summary>
    /// Creates the service over the entity write port.
    /// </summary>
    /// <param name="entities">Entity write repository implemented by Infrastructure.</param>
    public EntityCapabilityService(IEntityWriteRepository entities)
    {
        _entities = entities;
    }

    /// <summary>
    /// Sets or clears the entity's user rating.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="value">New rating value, or null to clear.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The mutated entity, or null when the entity does not exist.</returns>
    public Task<Entity?> RateAsync(Guid id, int? value, CancellationToken cancellationToken) =>
        MutateAsync(id, entity =>
        {
            var rating = entity.GetOrAddCapability(() => new CapabilityRating());
            if (value is { } v)
            {
                rating.Rate(v);
            }
            else
            {
                rating.Clear();
            }

            return true;
        }, cancellationToken);

    /// <summary>
    /// Patches the entity's flag capability. Any null argument leaves the corresponding flag unchanged.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="isFavorite">New favorite state, or null to leave unchanged.</param>
    /// <param name="isNsfw">New NSFW state, or null to leave unchanged.</param>
    /// <param name="isOrganized">New organized state, or null to leave unchanged.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The mutated entity, or null when the entity does not exist.</returns>
    public Task<Entity?> UpdateFlagsAsync(
        Guid id,
        bool? isFavorite,
        bool? isNsfw,
        bool? isOrganized,
        CancellationToken cancellationToken) =>
        MutateAsync(id, entity =>
        {
            entity.GetOrAddCapability(() => new CapabilityFlags())
                .Patch(isFavorite, isNsfw, isOrganized);
            return true;
        }, cancellationToken);

    /// <summary>
    /// Updates the entity's playback capability. Seconds inputs are converted to <see cref="TimeSpan"/>.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="resumeSeconds">Optional resume position in seconds.</param>
    /// <param name="durationSeconds">Optional playback session duration in seconds.</param>
    /// <param name="completed">Optional completion flag.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The mutated entity, or null when the entity does not exist.</returns>
    public Task<Entity?> UpdatePlaybackAsync(
        Guid id,
        double? resumeSeconds,
        double? durationSeconds,
        bool? completed,
        CancellationToken cancellationToken) =>
        MutateAsync(id, entity =>
        {
            entity.GetOrAddCapability(() => new CapabilityPlayback()).Update(
                resumeSeconds is null ? null : TimeSpan.FromSeconds(resumeSeconds.Value),
                durationSeconds is null ? null : TimeSpan.FromSeconds(durationSeconds.Value),
                completed,
                DateTimeOffset.UtcNow);
            return true;
        }, cancellationToken);

    /// <summary>
    /// Appends a new marker to the entity's marker capability.
    /// </summary>
    public Task<Entity?> AddMarkerAsync(
        Guid id,
        string title,
        double seconds,
        double? endSeconds,
        CancellationToken cancellationToken) =>
        MutateAsync(id, entity =>
        {
            entity.GetOrAddCapability(() => new CapabilityMarkers()).Add(title, seconds, endSeconds);
            return true;
        }, cancellationToken);

    /// <summary>
    /// Updates one existing marker on the entity. Returns the entity only when the marker exists.
    /// </summary>
    public Task<Entity?> UpdateMarkerAsync(
        Guid id,
        Guid markerId,
        string title,
        double seconds,
        double? endSeconds,
        CancellationToken cancellationToken) =>
        MutateAsync(id, entity =>
            entity.GetOrAddCapability(() => new CapabilityMarkers())
                .Update(markerId, title, seconds, endSeconds),
            cancellationToken);

    /// <summary>
    /// Removes one marker from the entity. Returns the entity only when the marker existed.
    /// </summary>
    public Task<Entity?> DeleteMarkerAsync(
        Guid id,
        Guid markerId,
        CancellationToken cancellationToken) =>
        MutateAsync(id, entity =>
            entity.GetOrAddCapability(() => new CapabilityMarkers()).Delete(markerId),
            cancellationToken);

    private async Task<Entity?> MutateAsync(
        Guid id,
        Func<Entity, bool> mutate,
        CancellationToken cancellationToken)
    {
        var entity = await _entities.FindAsync(id, cancellationToken);
        if (entity is null || !mutate(entity))
        {
            return null;
        }

        await _entities.SaveAsync(entity, cancellationToken);
        return entity;
    }
}
