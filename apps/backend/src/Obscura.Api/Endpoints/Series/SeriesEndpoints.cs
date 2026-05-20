using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Series;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

public static class SeriesEndpoints {
    public static IEndpointRouteBuilder MapSeriesEndpoints(this IEndpointRouteBuilder routes) {
        routes.MapEntityKindRoutes(
            "/api/series",
            "video-series",
            "Series",
            "ListVideoSeries",
            "GetVideoSeries",
            typeof(EntityListResponse),
            typeof(VideoSeriesDetail));

        routes.MapGet("/api/series/{id:guid}/seasons/{seasonId:guid}", async (
            Guid id,
            Guid seasonId,
            IEntityReadService entities,
            CancellationToken cancellationToken) =>
            await EntityKindRouteEndpoints.GetKindDetailAsync(seasonId, "video-season", entities, cancellationToken))
            .WithTags("Series")
            .WithName("GetVideoSeason")
            .Produces<VideoSeasonDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return routes;
    }
}
