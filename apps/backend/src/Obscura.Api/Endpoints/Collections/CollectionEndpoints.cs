using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;

namespace Obscura.Api.Endpoints;

public static class CollectionEndpoints {
    public static RouteGroupBuilder MapCollectionEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/collections",
            "collection",
            "Collections",
            "ListCollections",
            "GetCollection",
            typeof(EntityListResponse),
            typeof(CollectionDetail));
}
