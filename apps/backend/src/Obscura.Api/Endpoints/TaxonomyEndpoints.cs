using Obscura.Application.Entities;
using Obscura.Application.Taxonomy;
using Obscura.Contracts.System;
using Obscura.Contracts.Taxonomy;
using Obscura.Domain.Entities;

namespace Obscura.Api.Endpoints;

public static class TaxonomyEndpoints
{
    public static IEndpointRouteBuilder MapTaxonomyEndpoints(this IEndpointRouteBuilder routes)
    {
        MapTaxonomyGroup<PersonDetail>(
            routes,
            "/api/people",
            "People",
            EntityKindRegistry.Person,
            (taxonomy, query, cancellationToken) => taxonomy.ListPeopleAsync(query, cancellationToken),
            (taxonomy, id, cancellationToken) => taxonomy.GetPersonAsync(id, cancellationToken));
        MapTaxonomyGroup<StudioDetail>(
            routes,
            "/api/studios",
            "Studios",
            EntityKindRegistry.Studio,
            (taxonomy, query, cancellationToken) => taxonomy.ListStudiosAsync(query, cancellationToken),
            (taxonomy, id, cancellationToken) => taxonomy.GetStudioAsync(id, cancellationToken));
        MapTaxonomyGroup<TagDetail>(
            routes,
            "/api/tags",
            "Tags",
            EntityKindRegistry.Tag,
            (taxonomy, query, cancellationToken) => taxonomy.ListTagsAsync(query, cancellationToken),
            (taxonomy, id, cancellationToken) => taxonomy.GetTagAsync(id, cancellationToken));

        return routes;
    }

    private static void MapTaxonomyGroup<TDetail>(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        IEntityKind kind,
        Func<TaxonomyService, EntityListQuery, CancellationToken, Task<TaxonomyListResponse>> list,
        Func<TaxonomyService, Guid, CancellationToken, Task<TDetail?>> get)
        where TDetail : class
    {
        var group = routes.MapGroup(path)
            .WithTags(tag);

        group.MapGet("/", async (
            string? query,
            string? cursor,
            TaxonomyService taxonomy,
            CancellationToken cancellationToken) =>
        {
            return await list(taxonomy, new EntityListQuery(null, query, cursor), cancellationToken);
        })
            .WithName($"List{tag}")
            .WithSummary($"Lists {kind.Code} entities through the application layer.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            TaxonomyService taxonomy,
            CancellationToken cancellationToken) =>
        {
            var detail = await get(taxonomy, id, cancellationToken);
            return detail is null
                ? Results.NotFound(new ApiProblem(
                    $"{kind.Code}_not_found",
                    $"{tag.TrimEnd('s')} '{id}' was not found."))
                : Results.Ok(detail);
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind.Code} entity through the application layer.")
            .Produces<TDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }
}
