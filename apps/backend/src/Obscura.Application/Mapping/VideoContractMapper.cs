using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using DomainMarker = Obscura.Domain.Capabilities.EntityMarker;
using DomainSubtitle = Obscura.Domain.Capabilities.EntitySubtitle;
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
            video.Description,
            video.Technical?.Duration,
            video.Technical?.Width,
            video.Technical?.Height,
            video.MarkerCapability?.Items.Select(ToVideoMarker).ToArray() ?? [],
            video.SubtitleCapability?.Items.Select(ToVideoSubtitle).ToArray() ?? [],
            ToEntityCapabilities(video.Capabilities));

    private static VideoMarker ToVideoMarker(DomainMarker marker) =>
        new(marker.Id, marker.Title, marker.Seconds, marker.EndSeconds);

    private static VideoSubtitle ToVideoSubtitle(DomainSubtitle subtitle) =>
        new(
            subtitle.Id,
            subtitle.Language,
            subtitle.Label,
            subtitle.Format,
            subtitle.Source.ToCode(),
            subtitle.StoragePath,
            subtitle.SourceFormat,
            subtitle.SourcePath,
            subtitle.IsDefault);
}
