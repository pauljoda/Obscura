using Obscura.Api.Mapping;
using Obscura.Contracts.Collections;
using Obscura.Contracts.System;
using Obscura.Domain.Interfaces;

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
            IEntityCatalog entities,
            CancellationToken cancellationToken) =>
        {
            var response = await entities.ListAsync("collection", query, cursor, cancellationToken);
            return ContractMapper.ToCollectionListResponse(response);
        })
            .WithName("ListCollections")
            .WithSummary("Lists collection entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityCatalog entities,
            CancellationToken cancellationToken) =>
        {
            var entity = await entities.GetAsync(id, cancellationToken);
            if (entity is null || !entity.Kind.Code.Equals("collection", StringComparison.OrdinalIgnoreCase))
            {
                return Results.NotFound(new ApiProblem(
                    "collection_not_found",
                    $"Collection '{id}' was not found."));
            }

            var items = await entities.ListChildrenAsync(id, "collection-item", null, cancellationToken);

            return Results.Ok(ContractMapper.ToCollectionDetail(entity, items));
        })
            .WithName("GetCollection")
            .WithSummary("Gets one collection entity with its projected items.")
            .Produces<CollectionDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return routes;
    }
}
