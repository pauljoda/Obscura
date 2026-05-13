using Obscura.Application.Entities;
using Obscura.Application.Taxonomy;
using Obscura.Contracts.System;
using Obscura.Contracts.Taxonomy;

namespace Obscura.Api.Endpoints;

public static class TaxonomyEndpoints
{
    public static IEndpointRouteBuilder MapTaxonomyEndpoints(this IEndpointRouteBuilder routes)
    {
        MapTaxonomyGroup<PersonDetail>(
            routes,
            "/api/people",
            "People",
            "person",
            (taxonomy, query, cancellationToken) => taxonomy.ListPeopleAsync(query, cancellationToken),
            (taxonomy, id, cancellationToken) => taxonomy.GetPersonAsync(id, cancellationToken));
        MapTaxonomyGroup<StudioDetail>(
            routes,
            "/api/studios",
            "Studios",
            "studio",
            (taxonomy, query, cancellationToken) => taxonomy.ListStudiosAsync(query, cancellationToken),
            (taxonomy, id, cancellationToken) => taxonomy.GetStudioAsync(id, cancellationToken));
        MapTaxonomyGroup<TagDetail>(
            routes,
            "/api/tags",
            "Tags",
            "tag",
            (taxonomy, query, cancellationToken) => taxonomy.ListTagsAsync(query, cancellationToken),
            (taxonomy, id, cancellationToken) => taxonomy.GetTagAsync(id, cancellationToken));

        return routes;
    }

    private static void MapTaxonomyGroup<TDetail>(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        string kindCode,
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
            .WithSummary($"Lists {kindCode} entities through the application layer.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            TaxonomyService taxonomy,
            CancellationToken cancellationToken) =>
        {
            var detail = await get(taxonomy, id, cancellationToken);
            return detail is null
                ? Results.NotFound(new ApiProblem(
                    $"{kindCode}_not_found",
                    $"{tag.TrimEnd('s')} '{id}' was not found."))
                : Results.Ok(detail);
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kindCode} entity through the application layer.")
            .Produces<TDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }
}
