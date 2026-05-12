using Obscura.Api.Mapping;
using Obscura.Application.Collections;
using Obscura.Application.Entities;
using Obscura.Contracts.Collections;
using Obscura.Contracts.System;

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
            CollectionService collections,
            CancellationToken cancellationToken) =>
        {
            var response = await collections.ListAsync(new EntityListQuery("collection", query, cursor), cancellationToken);
            return ContractMapper.ToCollectionListResponse(response);
        })
            .WithName("ListCollections")
            .WithSummary("Lists collection entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            CollectionService collections,
            CancellationToken cancellationToken) =>
        {
            var collection = await collections.GetAsync(id, cancellationToken);
            if (collection is null)
            {
                return Results.NotFound(new ApiProblem(
                    "collection_not_found",
                    $"Collection '{id}' was not found."));
            }

            return Results.Ok(ContractMapper.ToCollectionDetail(collection));
        })
            .WithName("GetCollection")
            .WithSummary("Gets one collection entity with its projected items.")
            .Produces<CollectionDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return routes;
    }
}
