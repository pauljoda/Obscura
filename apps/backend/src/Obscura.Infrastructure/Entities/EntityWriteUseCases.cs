using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Domain.Capabilities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Domain-led entity state write use cases backed by the EF entity repository.
/// </summary>
public sealed class EntityWriteUseCases(
    EfEntityRepository entities,
    EfEntityReadUseCases reads)
{
    /// <summary>
    /// Sets or clears the user rating for one entity and returns the refreshed read model.
    /// </summary>
    public async Task<EntityCard?> SetRatingAsync(SetEntityRatingCommand command, CancellationToken cancellationToken)
    {
        var entity = await entities.FindAsync(command.EntityId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var rating = entity.Rating ?? new CapabilityRating();
        if (entity.Rating is null)
        {
            entity.AddCapability(rating);
        }

        if (command.Value is { } value)
        {
            rating.Rate(value);
        }
        else
        {
            rating.Clear();
        }

        await entities.SaveAsync(entity, cancellationToken);
        return await reads.GetAsync(entity.Id, cancellationToken);
    }

    /// <summary>
    /// Applies a sparse boolean flag update and returns the refreshed read model.
    /// </summary>
    public async Task<EntityCard?> UpdateFlagsAsync(UpdateEntityFlagsCommand command, CancellationToken cancellationToken)
    {
        var entity = await entities.FindAsync(command.EntityId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var flags = entity.Flags ?? new CapabilityFlags();
        if (entity.Flags is null)
        {
            entity.AddCapability(flags);
        }

        flags.Patch(command.IsFavorite, command.IsNsfw, command.IsOrganized);
        await entities.SaveAsync(entity, cancellationToken);
        return await reads.GetAsync(entity.Id, cancellationToken);
    }

    /// <summary>
    /// Records playback state for one entity and returns the refreshed read model.
    /// </summary>
    public async Task<EntityCard?> UpdatePlaybackAsync(UpdatePlaybackCommand command, CancellationToken cancellationToken)
    {
        var entity = await entities.FindAsync(command.EntityId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var playback = entity.PlaybackCapability ?? new CapabilityPlayback();
        if (entity.PlaybackCapability is null)
        {
            entity.AddCapability(playback);
        }

        playback.Update(
            command.ResumeSeconds is null ? null : TimeSpan.FromSeconds(command.ResumeSeconds.Value),
            command.DurationSeconds is null ? null : TimeSpan.FromSeconds(command.DurationSeconds.Value),
            command.Completed,
            DateTimeOffset.UtcNow);
        await entities.SaveAsync(entity, cancellationToken);
        return await reads.GetAsync(entity.Id, cancellationToken);
    }

    /// <summary>
    /// Creates a timeline marker for one entity and returns the refreshed read model.
    /// </summary>
    public async Task<EntityCard?> CreateMarkerAsync(CreateEntityMarkerCommand command, CancellationToken cancellationToken)
    {
        var entity = await entities.FindAsync(command.EntityId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var markers = entity.MarkerCapability ?? new CapabilityMarkers();
        if (entity.MarkerCapability is null)
        {
            entity.AddCapability(markers);
        }

        markers.Add(command.Title, command.Seconds, command.EndSeconds);
        await entities.SaveAsync(entity, cancellationToken);
        return await reads.GetAsync(entity.Id, cancellationToken);
    }

    /// <summary>
    /// Updates an existing timeline marker and returns the refreshed read model.
    /// </summary>
    public async Task<EntityCard?> UpdateMarkerAsync(UpdateEntityMarkerCommand command, CancellationToken cancellationToken)
    {
        var entity = await entities.FindAsync(command.EntityId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        if (entity.MarkerCapability?.Update(command.MarkerId, command.Title, command.Seconds, command.EndSeconds) != true)
        {
            return null;
        }

        await entities.SaveAsync(entity, cancellationToken);
        return await reads.GetAsync(entity.Id, cancellationToken);
    }

    /// <summary>
    /// Deletes an existing timeline marker and returns the refreshed read model.
    /// </summary>
    public async Task<EntityCard?> DeleteMarkerAsync(DeleteEntityMarkerCommand command, CancellationToken cancellationToken)
    {
        var entity = await entities.FindAsync(command.EntityId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        if (entity.MarkerCapability?.Delete(command.MarkerId) != true)
        {
            return null;
        }

        await entities.SaveAsync(entity, cancellationToken);
        return await reads.GetAsync(entity.Id, cancellationToken);
    }
}
