using Obscura.Domain.Entities;
using Obscura.Domain.Media;

namespace Obscura.Domain.Interfaces;

public interface IVideoLibrary
{
    Task<EntityPage> ListVideosAsync(CancellationToken cancellationToken);

    Task<Video?> GetVideoAsync(Guid id, CancellationToken cancellationToken);

    Task<EntityPage> ListSeriesAsync(CancellationToken cancellationToken);

    Task<VideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken);
}
