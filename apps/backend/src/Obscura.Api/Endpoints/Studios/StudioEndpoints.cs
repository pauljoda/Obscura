using Obscura.Contracts.Entities;
using Obscura.Contracts.Taxonomy;

namespace Obscura.Api.Endpoints;

public static class StudioEndpoints {
    public static RouteGroupBuilder MapStudioEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/studios",
            "studio",
            "Taxonomy",
            "ListStudios",
            "GetStudio",
            typeof(EntityListResponse),
            typeof(StudioDetail));
}
