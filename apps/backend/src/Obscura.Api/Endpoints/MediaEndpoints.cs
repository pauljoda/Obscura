using Obscura.Api.Mapping;
using Obscura.Contracts.Media;
using Obscura.Contracts.System;
using Obscura.Domain.Interfaces;

namespace Obscura.Api.Endpoints;

public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder routes)
    {
        MapMediaGroup(routes, "/api/images", "Images", "image", null);
        MapMediaGroup(routes, "/api/galleries", "Galleries", "gallery", ("image", "image"));
        MapMediaGroup(routes, "/api/books", "Books", "book", null);
        MapMediaGroup(routes, "/api/audio-libraries", "AudioLibraries", "audio-library", ("audio-track", "audio-track"));
        MapMediaGroup(routes, "/api/audio-tracks", "AudioTracks", "audio-track", null);

        return routes;
    }

    private static void MapMediaGroup(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        string kind,
        (string Relationship, string ChildKind)? children)
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
            return ContractMapper.ToMediaListResponse(response);
        })
            .WithName($"List{tag}")
            .WithSummary($"Lists {kind} media entities through the global entity projection.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityCatalog entities,
            CancellationToken cancellationToken) =>
        {
            var entity = await entities.GetAsync(id, cancellationToken);
            if (entity is null || !entity.Kind.Code.Equals(kind, StringComparison.OrdinalIgnoreCase))
            {
                return Results.NotFound(new ApiProblem(
                    $"{kind}_not_found",
                    $"{tag} item '{id}' was not found."));
            }

            var childItems = children is null
                ? []
                : await entities.ListChildrenAsync(id, children.Value.Relationship, children.Value.ChildKind, cancellationToken);

            return Results.Ok(ContractMapper.ToMediaDetail(entity, childItems));
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind} media entity.")
            .Produces<MediaDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }
}
