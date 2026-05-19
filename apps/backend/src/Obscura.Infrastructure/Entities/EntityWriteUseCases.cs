using Obscura.Application.Entities;
using Obscura.Domain.Capabilities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Domain-led entity state write use cases backed by the EF entity repository.
/// </summary>
public sealed class EntityWriteUseCases(
    EntityRepository entities,
    IEntityReadUseCases reads) : IEntityWriteUseCases
{
    public async Task<object?> SetRatingAsync(SetEntityRatingCommand command, CancellationToken cancellationToken)
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

    public async Task<object?> UpdateFlagsAsync(UpdateEntityFlagsCommand command, CancellationToken cancellationToken)
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

    public async Task<object?> UpdatePlaybackAsync(UpdatePlaybackCommand command, CancellationToken cancellationToken)
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

    public async Task<object?> CreateMarkerAsync(CreateEntityMarkerCommand command, CancellationToken cancellationToken)
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

    public async Task<object?> UpdateMarkerAsync(UpdateEntityMarkerCommand command, CancellationToken cancellationToken)
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

    public async Task<object?> DeleteMarkerAsync(DeleteEntityMarkerCommand command, CancellationToken cancellationToken)
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
