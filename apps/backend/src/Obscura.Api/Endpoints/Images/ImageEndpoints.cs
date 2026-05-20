using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;

namespace Obscura.Api.Endpoints;

public static class ImageEndpoints {
    public static RouteGroupBuilder MapImageEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/images",
            "image",
            "Images",
            "ListImages",
            "GetImage",
            typeof(EntityListResponse),
            typeof(ImageDetail));
}
