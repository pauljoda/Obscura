using Obscura.Contracts.Entities;
using Obscura.Contracts.Videos;

namespace Obscura.Infrastructure.Entities;

public interface IEntityProjectionService
{
    Task<EntityListResponseDto> ListAsync(
        string? kind,
        string? query,
        string? cursor,
        CancellationToken cancellationToken);

    Task<EntityCardDto?> GetCardAsync(Guid id, CancellationToken cancellationToken);

    Task<EntityCardDto?> UpdateRatingAsync(
        Guid id,
        RatingUpdateRequestDto request,
        CancellationToken cancellationToken);

    Task<EntityCardDto?> UpdateFlagsAsync(
        Guid id,
        EntityFlagsUpdateRequestDto request,
        CancellationToken cancellationToken);

    Task<VideoListResponseDto> ListVideosAsync(CancellationToken cancellationToken);

    Task<VideoDetailDto?> GetVideoAsync(Guid id, CancellationToken cancellationToken);
}
