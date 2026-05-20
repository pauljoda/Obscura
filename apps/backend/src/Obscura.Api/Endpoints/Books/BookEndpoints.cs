using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;

namespace Obscura.Api.Endpoints;

public static class BookEndpoints {
    public static RouteGroupBuilder MapBookEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/books",
            "book",
            "Books",
            "ListBooks",
            "GetBook",
            typeof(EntityListResponse),
            typeof(BookDetail));
}
