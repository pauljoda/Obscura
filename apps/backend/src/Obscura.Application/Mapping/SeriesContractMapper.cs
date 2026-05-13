using Obscura.Contracts.Series;
using Obscura.Domain.Entities;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains video-series-specific detail contract mapping for v2 series routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts a video-series aggregate into the series detail contract.
    /// </summary>
    /// <param name="series">Domain series aggregate with child links and shared capabilities.</param>
    /// <returns>Video-series detail contract for API callers.</returns>
    public static VideoSeriesDetail ToVideoSeriesDetail(DomainVideoSeries series) =>
        new(
            series.Id,
            series.Kind.Code,
            series.Title,
            series.Description,
            ToEntityCapabilities(series.Capabilities),
            ToEntityCards(series.Children),
            ToEntityCards(series.Videos),
            series.RenderingMode.ToCode());
}
