using Obscura.Api.Mapping;
using Obscura.Application.Organization;
using Obscura.Contracts.Organize;
using Obscura.Infrastructure.Organization;

namespace Obscura.Api.Endpoints;

public static class OrganizeEndpoints
{
    public static RouteGroupBuilder MapOrganizeEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/organize")
            .WithTags("Organize");

        group.MapGet("/plan", async (
            Guid? entityId,
            Guid? rootId,
            EntityOrganizerService organizer,
            CancellationToken cancellationToken) =>
            Results.Ok((await organizer.PlanAsync(new OrganizePlanQuery(entityId, rootId), cancellationToken)).ToContract()))
            .WithName("GetOrganizePlan")
            .WithSummary("Computes a dry-run entity organization plan from generic storage metadata.")
            .Produces<OrganizePlanResponse>();

        group.MapPost("/apply", async (
            OrganizePlanRequest request,
            EntityOrganizerService organizer,
            CancellationToken cancellationToken) =>
            Results.Ok((await organizer.ApplyAsync(request.ToApplication(), cancellationToken)).ToContract()))
            .WithName("ApplyOrganizePlan")
            .WithSummary("Applies an entity organization plan by moving source files or folders.")
            .Produces<OrganizeApplyResponse>();

        return group;
    }
}
