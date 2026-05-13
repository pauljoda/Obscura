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
        MapTaxonomyGroup(routes, "/api/people", "People", EntityKindRegistry.Person);
        MapTaxonomyGroup(routes, "/api/studios", "Studios", EntityKindRegistry.Studio);
        MapTaxonomyGroup(routes, "/api/tags", "Tags", EntityKindRegistry.Tag);

        return routes;
    }

    private static void MapTaxonomyGroup(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        IEntityKind kind)
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
            IEntityDetails details,
            CancellationToken cancellationToken) =>
        {
            var entity = await GetTypedTaxonomyDetailAsync(id, kind, details, cancellationToken);
            if (entity is null)
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

    private static async Task<Entity?> GetTypedTaxonomyDetailAsync(
        Guid id,
        IEntityKind kind,
        IEntityDetails details,
        CancellationToken cancellationToken)
    {
        if (kind == EntityKindRegistry.Person)
        {
            return await details.GetPersonAsync(id, cancellationToken);
        }

        if (kind == EntityKindRegistry.Studio)
        {
            return await details.GetStudioAsync(id, cancellationToken);
        }

        if (kind == EntityKindRegistry.Tag)
        {
            return await details.GetTagAsync(id, cancellationToken);
        }

        return null;
    }
}
