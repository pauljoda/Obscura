using Obscura.Contracts.Entities;
using Obscura.Contracts.Taxonomy;

namespace Obscura.Api.Endpoints;

public static class TagEndpoints {
    public static RouteGroupBuilder MapTagEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/tags",
            "tag",
            "Taxonomy",
            "ListTags",
            "GetTag",
            typeof(EntityListResponse),
            typeof(TagDetail));
}
