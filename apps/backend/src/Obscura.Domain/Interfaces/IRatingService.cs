using Obscura.Domain.Entities;

namespace Obscura.Domain.Interfaces;

public interface IRatingService
{
    Task<Entity?> UpdateRatingAsync(
        Guid id,
        int? value,
        CancellationToken cancellationToken);

    Task<Entity?> UpdateFlagsAsync(
        Guid id,
        bool? isFavorite,
        bool? isNsfw,
        bool? isOrganized,
        CancellationToken cancellationToken);
}
