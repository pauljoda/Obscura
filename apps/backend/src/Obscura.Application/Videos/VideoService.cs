using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;

namespace Obscura.Application.Videos;

/// <summary>
/// Application use-case service for video and video-series browsing.
/// </summary>
public sealed class VideoService
{
    private readonly IVideoLibrary _videos;

    /// <summary>
    /// Creates a video service over the domain video library port.
    /// </summary>
    /// <param name="videos">Video library used to project video aggregates.</param>
    public VideoService(IVideoLibrary videos)
    {
        _videos = videos;
    }

    /// <summary>
    /// Lists video entity roots.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A page of video entities.</returns>
    public Task<EntityPage> ListVideosAsync(CancellationToken cancellationToken) =>
        _videos.ListVideosAsync(cancellationToken);

    /// <summary>
    /// Gets one video aggregate.
    /// </summary>
    /// <param name="id">Video entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The video aggregate, or null when missing.</returns>
    public Task<Video?> GetVideoAsync(Guid id, CancellationToken cancellationToken) =>
        _videos.GetVideoAsync(id, cancellationToken);

    /// <summary>
    /// Lists video series entity roots.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>A page of video series entities.</returns>
    public Task<EntityPage> ListSeriesAsync(CancellationToken cancellationToken) =>
        _videos.ListSeriesAsync(cancellationToken);

    /// <summary>
    /// Gets one video series aggregate.
    /// </summary>
    /// <param name="id">Video series entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>The video series aggregate, or null when missing.</returns>
    public Task<VideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken) =>
        _videos.GetSeriesAsync(id, cancellationToken);
}
