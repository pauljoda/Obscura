using Obscura.Domain.Entities;
using Obscura.Domain.Media;

namespace Obscura.Domain.Interfaces;

/// <summary>
/// Reads video-oriented aggregates from the global entity model.
/// </summary>
public interface IVideoLibrary
{
    /// <summary>
    /// Lists video entities for browsing surfaces.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>A page of video entity roots.</returns>
    Task<EntityPage> ListVideosAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Gets one video with video-specific playback detail, markers, subtitles, and shared capabilities.
    /// </summary>
    /// <param name="id">Video entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>The video aggregate, or null when the video is missing.</returns>
    Task<Video?> GetVideoAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Lists video series entities for side-by-side v2 route testing.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>A page of video series entity roots.</returns>
    Task<EntityPage> ListSeriesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Gets one video series with projected child video links.
    /// </summary>
    /// <param name="id">Video series entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the query.</param>
    /// <returns>The video series aggregate, or null when the series is missing.</returns>
    Task<VideoSeries?> GetSeriesAsync(Guid id, CancellationToken cancellationToken);
}
