namespace Obscura.Application.Entities;

/// <summary>
/// Application port for EF-projected entity read models.
/// </summary>
public interface IEntityReadUseCases
{
    Task<object> ListAsync(string? kind, string? query, string? cursor, bool? hideNsfw, CancellationToken cancellationToken);

    Task<object?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<object> GetThumbnailsAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken);

    Task<object?> GetDetailAsync(Guid id, string kind, CancellationToken cancellationToken);
}
