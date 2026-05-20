using Obscura.Contracts.Entities;
using Obscura.Contracts.Taxonomy;

namespace Obscura.Api.Endpoints;

public static class PeopleEndpoints {
    public static RouteGroupBuilder MapPeopleEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/people",
            "person",
            "Taxonomy",
            "ListPeople",
            "GetPerson",
            typeof(EntityListResponse),
            typeof(PersonDetail));
}
