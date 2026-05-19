namespace Obscura.Application.Entities;

/// <summary>
/// Application port for domain-led entity state writes.
/// </summary>
public interface IEntityWriteUseCases
{
    Task<object?> SetRatingAsync(SetEntityRatingCommand command, CancellationToken cancellationToken);

    Task<object?> UpdateFlagsAsync(UpdateEntityFlagsCommand command, CancellationToken cancellationToken);

    Task<object?> UpdatePlaybackAsync(UpdatePlaybackCommand command, CancellationToken cancellationToken);

    Task<object?> CreateMarkerAsync(CreateEntityMarkerCommand command, CancellationToken cancellationToken);

    Task<object?> UpdateMarkerAsync(UpdateEntityMarkerCommand command, CancellationToken cancellationToken);

    Task<object?> DeleteMarkerAsync(DeleteEntityMarkerCommand command, CancellationToken cancellationToken);
}
