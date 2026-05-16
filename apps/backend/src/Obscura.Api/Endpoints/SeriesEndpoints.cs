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
            await videos.ListSeriesAsync(cancellationToken))
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
                    : Results.Ok(series);
            })
            .WithName("GetSeries")
            .WithSummary("Gets one video series detail record.")
            .Produces<VideoSeriesDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapGet("/{id:guid}/seasons/{seasonId:guid}", async (
            Guid id,
            Guid seasonId,
            VideoService videos,
            CancellationToken cancellationToken) =>
            {
                var season = await videos.GetSeasonAsync(id, seasonId, cancellationToken);

                return season is null
                    ? Results.NotFound(new ApiProblem(
                        "season_not_found",
                        $"Season '{seasonId}' was not found in series '{id}'."))
                    : Results.Ok(season);
            })
            .WithName("GetSeriesSeason")
            .WithSummary("Gets one video season detail record with ordered episodes.")
            .Produces<VideoSeasonDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}
