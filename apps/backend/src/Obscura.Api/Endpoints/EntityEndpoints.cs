using Obscura.Api.Mapping;
using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;
using Obscura.Domain.Entities;

namespace Obscura.Api.Endpoints;

public static class EntityEndpoints
{
    public static RouteGroupBuilder MapEntityEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/entities")
            .WithTags("Entities");

        group.MapGet("/", async (
            string? kind,
            string? query,
            string? cursor,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                if (!TryResolveEntityKind(kind, out var entityKind, out var problem))
                {
                    return Results.BadRequest(problem);
                }

                var response = await entities.ListAsync(new EntityListQuery(entityKind, query, cursor), cancellationToken);
                return Results.Ok(ContractMapper.ToEntityListResponse(response));
            })
            .WithName("ListEntities")
            .WithSummary("Lists global entities with optional kind, search, and cursor filters.")
            .Produces<EntityListResponse>()
            .Produces<ApiProblem>(StatusCodes.Status400BadRequest);

        group.MapGet("/{id:guid}", async (
            Guid id,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.GetAsync(id, cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(ContractMapper.ToEntityCard(entity));
            })
            .WithName("GetEntity")
            .WithSummary("Gets one global entity by id.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/rating", async (
            Guid id,
            RatingUpdateRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.SetRatingAsync(
                    new SetEntityRatingCommand(id, request.Value),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(ContractMapper.ToEntityCard(entity));
            })
            .WithName("UpdateEntityRating")
            .WithSummary("Updates the shared rating capability for one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/flags", async (
            Guid id,
            EntityFlagsUpdateRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.UpdateFlagsAsync(
                    new UpdateEntityFlagsCommand(
                        id,
                        request.IsFavorite,
                        request.IsNsfw,
                        request.IsOrganized),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(ContractMapper.ToEntityCard(entity));
            })
            .WithName("UpdateEntityFlags")
            .WithSummary("Updates shared boolean flags for one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }

    private static bool TryResolveEntityKind(string? code, out IEntityKind? kind, out ApiProblem? problem)
    {
        kind = null;
        problem = null;

        if (string.IsNullOrWhiteSpace(code))
        {
            return true;
        }

        if (EntityKindRegistry.TryGet(code, out var knownKind))
        {
            kind = knownKind;
            return true;
        }

        problem = new ApiProblem(
            "unknown_entity_kind",
            $"Entity kind '{code}' is not supported by this Obscura backend.");
        return false;
    }
}
