using Obscura.Api.Mapping;
using Obscura.Contracts.Media;
using Obscura.Contracts.System;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Api.Endpoints;

public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder routes)
    {
        MapMediaGroup(routes, "/api/images", "Images", EntityKinds.Image, null);
        MapMediaGroup(routes, "/api/galleries", "Galleries", EntityKinds.Gallery, (EntityRelationships.GalleryImage, EntityKinds.Image));
        MapMediaGroup(routes, "/api/books", "Books", EntityKinds.Book, null);
        MapMediaGroup(routes, "/api/audio-libraries", "AudioLibraries", EntityKinds.AudioLibrary, (EntityRelationships.AudioTrack, EntityKinds.AudioTrack));
        MapMediaGroup(routes, "/api/audio-tracks", "AudioTracks", EntityKinds.AudioTrack, null);

        return routes;
    }

    private static void MapMediaGroup(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        EntityKind kind,
        (EntityRelationship Relationship, EntityKind ChildKind)? children)
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
            .WithSummary($"Lists {kind.Code} media entities through the global entity projection.");

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
                    $"{tag} item '{id}' was not found."));
            }

            var childItems = children is null
                ? []
                : await entities.ListChildrenAsync(id, children.Value.Relationship, children.Value.ChildKind, cancellationToken);

            return Results.Ok(ContractMapper.ToMediaDetail(entity, childItems));
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind.Code} media entity.")
            .Produces<MediaDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }
}
