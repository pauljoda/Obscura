using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;

namespace Obscura.Api.Endpoints;

public static class GalleryEndpoints {
    public static RouteGroupBuilder MapGalleryEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/galleries",
            "gallery",
            "Galleries",
            "ListGalleries",
            "GetGallery",
            typeof(EntityListResponse),
            typeof(GalleryDetail));
}
