using Obscura.Api.Mapping;
using Obscura.Contracts.System;
using Obscura.Contracts.Taxonomy;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Api.Endpoints;

public static class TaxonomyEndpoints
{
    public static IEndpointRouteBuilder MapTaxonomyEndpoints(this IEndpointRouteBuilder routes)
    {
        MapTaxonomyGroup(routes, "/api/people", "People", EntityKind.Person);
        MapTaxonomyGroup(routes, "/api/studios", "Studios", EntityKind.Studio);
        MapTaxonomyGroup(routes, "/api/tags", "Tags", EntityKind.Tag);

        return routes;
    }

    private static void MapTaxonomyGroup(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        EntityKind kind)
    {
        var group = routes.MapGroup(path)
            .WithTags(tag);

        group.MapGet("/", async (
            string? query,
            string? cursor,
            IEntityCatalog entities,
            CancellationToken cancellationToken) =>
        {
            var response = await entities.ListAsync(kind, query, cursor, cancellationToken);
            return ContractMapper.ToTaxonomyListResponse(response);
        })
            .WithName($"List{tag}")
            .WithSummary($"Lists {kind.Code} entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityCatalog entities,
            CancellationToken cancellationToken) =>
        {
            var entity = await entities.GetAsync(id, cancellationToken);
            if (entity is null || entity.Kind.Value != kind.Value)
            {
                return Results.NotFound(new ApiProblem(
                    $"{kind.Code}_not_found",
                    $"{tag.TrimEnd('s')} '{id}' was not found."));
            }

            return Results.Ok(ContractMapper.ToTaxonomyDetail(entity));
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind.Code} entity.")
            .Produces<TaxonomyDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }
}
