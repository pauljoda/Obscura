using Obscura.Contracts.Entities;
using Obscura.Contracts.System;
using Obscura.Infrastructure.Entities;

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
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
            await entities.ListAsync(kind, query, cursor, cancellationToken))
            .WithName("ListEntities")
            .WithSummary("Lists global entities with optional kind, search, and cursor filters.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.GetCardAsync(id, cancellationToken);

                return entity is null
                    ? Results.NotFound(new ProblemDetailsDto(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("GetEntity")
            .WithSummary("Gets one global entity by id.")
            .Produces<EntityCardDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/rating", async (
            Guid id,
            RatingUpdateRequestDto request,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.UpdateRatingAsync(id, request, cancellationToken);

                return entity is null
                    ? Results.NotFound(new ProblemDetailsDto(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("UpdateEntityRating")
            .WithSummary("Updates the shared rating capability for one entity.")
            .Produces<EntityCardDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/flags", async (
            Guid id,
            EntityFlagsUpdateRequestDto request,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.UpdateFlagsAsync(id, request, cancellationToken);

                return entity is null
                    ? Results.NotFound(new ProblemDetailsDto(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("UpdateEntityFlags")
            .WithSummary("Updates shared boolean flags for one entity.")
            .Produces<EntityCardDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);

        return group;
    }
}
