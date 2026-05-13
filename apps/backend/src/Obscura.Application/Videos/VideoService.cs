using Obscura.Application.Mapping;
using Obscura.Contracts.Series;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

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
    /// <returns>API-ready video list response.</returns>
    public async Task<VideoListResponse> ListVideosAsync(CancellationToken cancellationToken)
    {
        var page = await _videos.ListVideosAsync(cancellationToken);
        return ContractMapper.ToVideoListResponse(page);
    }

    /// <summary>
    /// Gets one video aggregate.
    /// </summary>
    /// <param name="id">Video entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready video detail contract, or null when missing.</returns>
    public async Task<VideoDetail?> GetVideoAsync(Guid id, CancellationToken cancellationToken)
    {
        var video = await _videos.GetVideoAsync(id, cancellationToken);
        return video is null ? null : ContractMapper.ToVideoDetail(video);
    }

    /// <summary>
    /// Lists video series entity roots.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready video-series list response.</returns>
    public async Task<VideoSeriesListResponse> ListSeriesAsync(CancellationToken cancellationToken)
    {
        var page = await _videos.ListSeriesAsync(cancellationToken);
        return ContractMapper.ToVideoSeriesListResponse(page);
    }

    /// <summary>
    /// Gets one video series aggregate.
    /// </summary>
    /// <param name="id">Video series entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready video-series detail contract, or null when missing.</returns>
    public async Task<VideoSeriesDetail?> GetSeriesAsync(Guid id, CancellationToken cancellationToken)
    {
        var series = await _videos.GetSeriesAsync(id, cancellationToken);
        return series is null ? null : ContractMapper.ToVideoSeriesDetail(series);
    }
}
