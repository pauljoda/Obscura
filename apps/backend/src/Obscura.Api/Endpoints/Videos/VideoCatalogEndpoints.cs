using Obscura.Contracts.Entities;
using Obscura.Contracts.Videos;

namespace Obscura.Api.Endpoints;

internal static class VideoCatalogEndpoints {
    internal static RouteGroupBuilder MapVideoCatalogEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/videos",
            "video",
            "Videos",
            "ListVideos",
            "GetVideo",
            typeof(EntityListResponse),
            typeof(VideoDetail));
}
