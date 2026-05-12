using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;

namespace Obscura.Application.Entities;

public interface IEntityCatalog
{
    Task<EntityListResponse> ListAsync(
        string? kind,
        string? query,
        string? cursor,
        CancellationToken cancellationToken);

    Task<EntityCard?> GetCardAsync(Guid id, CancellationToken cancellationToken);

    Task<IReadOnlyList<EntityCard>> ListChildrenAsync(
        Guid parentId,
        string relationship,
        string? childKind,
        CancellationToken cancellationToken);

    Task<EntityCard?> UpdateRatingAsync(
        Guid id,
        RatingUpdateRequest request,
        CancellationToken cancellationToken);

    Task<EntityCard?> UpdateFlagsAsync(
        Guid id,
        EntityFlagsUpdateRequest request,
        CancellationToken cancellationToken);

    Task<VideoListResponse> ListVideosAsync(CancellationToken cancellationToken);

    Task<VideoDetail?> GetVideoAsync(Guid id, CancellationToken cancellationToken);

    Task<VideoSeriesListResponse> ListSeriesAsync(CancellationToken cancellationToken);

    Task<VideoSeriesDetail?> GetSeriesAsync(Guid id, CancellationToken cancellationToken);
}
