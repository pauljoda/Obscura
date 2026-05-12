using Obscura.Api.Mapping;
using Obscura.Application.Videos;
using Obscura.Contracts.Series;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

public static class SeriesEndpoints
{
    public static RouteGroupBuilder MapSeriesEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/series")
            .WithTags("Series");

        group.MapGet("/", async (
            VideoService videos,
            CancellationToken cancellationToken) =>
            ContractMapper.ToVideoSeriesListResponse(await videos.ListSeriesAsync(cancellationToken)))
            .WithName("ListSeries")
            .WithSummary("Lists video series entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            VideoService videos,
            CancellationToken cancellationToken) =>
            {
                var series = await videos.GetSeriesAsync(id, cancellationToken);

                return series is null
                    ? Results.NotFound(new ApiProblem(
                        "series_not_found",
                        $"Series '{id}' was not found."))
                    : Results.Ok(ContractMapper.ToVideoSeriesDetail(series));
            })
            .WithName("GetSeries")
            .WithSummary("Gets one video series detail record.")
            .Produces<VideoSeriesDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}
