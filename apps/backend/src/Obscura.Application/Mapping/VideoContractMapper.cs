using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using DomainVideo = Obscura.Domain.Media.Video;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains video-specific detail contract mapping for v2 video routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts a video aggregate into the video detail contract.
    /// </summary>
    /// <param name="video">Domain video aggregate with playback metadata and shared capabilities.</param>
    /// <returns>Video detail contract for API callers.</returns>
    public static VideoDetail ToVideoDetail(DomainVideo video) =>
        new(
            video.Id,
            video.Kind.Code,
            video.Title,
            ToEntityCapabilities(video.Capabilities),
            video.SubtitlesExtractedAt);
}
