using Obscura.Api.Mapping;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;
using Obscura.Domain.Interfaces;

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
            IEntityCatalog entities,
            CancellationToken cancellationToken) =>
            ContractMapper.ToEntityListResponse(await entities.ListAsync(kind, query, cursor, cancellationToken)))
            .WithName("ListEntities")
            .WithSummary("Lists global entities with optional kind, search, and cursor filters.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityCatalog entities,
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
            IRatingService ratings,
            CancellationToken cancellationToken) =>
            {
                var entity = await ratings.UpdateRatingAsync(id, request.Value, cancellationToken);

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
            IRatingService ratings,
            CancellationToken cancellationToken) =>
            {
                var entity = await ratings.UpdateFlagsAsync(
                    id,
                    request.IsFavorite,
                    request.IsNsfw,
                    request.IsOrganized,
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
}
