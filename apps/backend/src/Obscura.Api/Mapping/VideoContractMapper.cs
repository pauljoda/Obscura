using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;
using DomainMarker = Obscura.Domain.Capabilities.EntityMarker;
using DomainSubtitle = Obscura.Domain.Capabilities.EntitySubtitle;
using DomainVideo = Obscura.Domain.Media.Video;

namespace Obscura.Api.Mapping;

public static partial class ContractMapper
{
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
