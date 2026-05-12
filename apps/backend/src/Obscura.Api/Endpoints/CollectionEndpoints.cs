using Obscura.Contracts.Collections;
using Obscura.Contracts.System;
using Obscura.Infrastructure.Entities;

namespace Obscura.Api.Endpoints;

public static class CollectionEndpoints
{
    public static IEndpointRouteBuilder MapCollectionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/collections")
            .WithTags("Collections");

        group.MapGet("/", async (
            string? query,
            string? cursor,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
        {
            var response = await entities.ListAsync("collection", query, cursor, cancellationToken);
            return new CollectionListResponseDto(response.Items, response.NextCursor);
        })
            .WithName("ListCollections")
            .WithSummary("Lists collection entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
        {
            var entity = await entities.GetCardAsync(id, cancellationToken);
            if (entity is null || !entity.Kind.Equals("collection", StringComparison.OrdinalIgnoreCase))
            {
                return Results.NotFound(new ProblemDetailsDto(
                    "collection_not_found",
                    $"Collection '{id}' was not found."));
            }

            var items = await entities.ListChildrenAsync(id, "collection-item", null, cancellationToken);

            return Results.Ok(new CollectionDetailDto(
                entity.Id,
                entity.Kind,
                entity.Title,
                entity.Capabilities,
                items));
        })
            .WithName("GetCollection")
            .WithSummary("Gets one collection entity with its projected items.")
            .Produces<CollectionDetailDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);

        return routes;
    }
}
