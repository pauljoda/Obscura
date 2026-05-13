using Obscura.Contracts.Series;
using Obscura.Domain.Entities;
using DomainVideoSeries = Obscura.Domain.Media.VideoSeries;

namespace Obscura.Api.Mapping;

public static partial class ContractMapper
{
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
