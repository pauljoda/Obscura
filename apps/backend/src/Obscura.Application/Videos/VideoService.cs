using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;

namespace Obscura.Application.Videos;

public sealed class VideoService
{
    private readonly IVideoLibrary _videos;

    public VideoService(IVideoLibrary videos)
    {
        _videos = videos;
    }

    public Task<EntityPage> ListVideosAsync(CancellationToken cancellationToken) =>
        _videos.ListVideosAsync(cancellationToken);

    public Task<Video?> GetVideoAsync(Guid id, CancellationToken cancellationToken) =>
        _videos.GetVideoAsync(id, cancellationToken);

    public Task<EntityPage> ListSeriesAsync(CancellationToken cancellationToken) =>
        _videos.ListSeriesAsync(cancellationToken);

    public Task<VideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken) =>
        _videos.GetSeriesAsync(id, cancellationToken);
}
