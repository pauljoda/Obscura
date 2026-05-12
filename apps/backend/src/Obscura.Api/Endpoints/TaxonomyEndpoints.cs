using Obscura.Contracts.System;
using Obscura.Contracts.Taxonomy;
using Obscura.Infrastructure.Entities;

namespace Obscura.Api.Endpoints;

public static class TaxonomyEndpoints
{
    public static IEndpointRouteBuilder MapTaxonomyEndpoints(this IEndpointRouteBuilder routes)
    {
        MapTaxonomyGroup(routes, "/api/performers", "Performers", "performer");
        MapTaxonomyGroup(routes, "/api/studios", "Studios", "studio");
        MapTaxonomyGroup(routes, "/api/tags", "Tags", "tag");

        return routes;
    }

    private static void MapTaxonomyGroup(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        string kind)
    {
        var group = routes.MapGroup(path)
            .WithTags(tag);

        group.MapGet("/", async (
            string? query,
            string? cursor,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
        {
            var response = await entities.ListAsync(kind, query, cursor, cancellationToken);
            return new TaxonomyListResponseDto(response.Items, response.NextCursor);
        })
            .WithName($"List{tag}")
            .WithSummary($"Lists {kind} entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
        {
            var entity = await entities.GetCardAsync(id, cancellationToken);
            if (entity is null || !entity.Kind.Equals(kind, StringComparison.OrdinalIgnoreCase))
            {
                return Results.NotFound(new ProblemDetailsDto(
                    $"{kind}_not_found",
                    $"{tag.TrimEnd('s')} '{id}' was not found."));
            }

            return Results.Ok(new TaxonomyDetailDto(
                entity.Id,
                entity.Kind,
                entity.Title,
                entity.Capabilities));
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind} entity.")
            .Produces<TaxonomyDetailDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);
    }
}
