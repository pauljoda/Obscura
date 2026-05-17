using Obscura.Contracts.Series;
using Obscura.Domain.Entities;
using DomainVideoSeason = Obscura.Domain.Media.VideoSeason;
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
            series.ParentEntityId,
            ToEntityCapabilities(series.Capabilities),
            ToEntityChildGroups(series.ChildrenByKind),
            series.RenderingMode.ToCode());

    /// <summary>
    /// Converts a video-season aggregate into the season detail contract.
    /// </summary>
    /// <param name="season">Domain season aggregate with ordered episode links and shared capabilities.</param>
    /// <returns>Video-season detail contract for API callers.</returns>
    public static VideoSeasonDetail ToVideoSeasonDetail(DomainVideoSeason season) =>
        new(
            season.Id,
            season.Kind.Code,
            season.Title,
            season.ParentEntityId,
            ToEntityCapabilities(season.Capabilities),
            ToEntityChildGroups(season.ChildrenByKind));
}
