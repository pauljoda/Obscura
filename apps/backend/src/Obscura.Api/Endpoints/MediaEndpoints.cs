using Obscura.Api.Mapping;
using Obscura.Contracts.Media;
using Obscura.Contracts.System;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;

namespace Obscura.Api.Endpoints;

public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder routes)
    {
        MapMediaGroup<ImageDetail>(
            routes,
            "/api/images",
            "Images",
            EntityKindRegistry.Image,
            null,
            (entity, _) => ContractMapper.ToImageDetail((Image)entity));
        MapMediaGroup<GalleryDetail>(
            routes,
            "/api/galleries",
            "Galleries",
            EntityKindRegistry.Gallery,
            (EntityRelationshipRegistry.Gallery, EntityKindRegistry.Image),
            (entity, childItems) => ContractMapper.ToGalleryDetail((Gallery)entity, childItems));
        MapMediaGroup<BookDetail>(
            routes,
            "/api/books",
            "Books",
            EntityKindRegistry.Book,
            null,
            (entity, _) => ContractMapper.ToBookDetail((Book)entity));
        MapMediaGroup<AudioLibraryDetail>(
            routes,
            "/api/audio-libraries",
            "AudioLibraries",
            EntityKindRegistry.AudioLibrary,
            (EntityRelationshipRegistry.AudioLibrary, EntityKindRegistry.AudioTrack),
            (entity, childItems) => ContractMapper.ToAudioLibraryDetail((AudioLibrary)entity, childItems));
        MapMediaGroup<AudioTrackDetail>(
            routes,
            "/api/audio-tracks",
            "AudioTracks",
            EntityKindRegistry.AudioTrack,
            null,
            (entity, _) => ContractMapper.ToAudioTrackDetail((AudioTrack)entity));

        return routes;
    }

    private static void MapMediaGroup<TDetail>(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        IEntityKind kind,
        (IEntityRelationship Relationship, IEntityKind ChildKind)? children,
        Func<Entity, IReadOnlyList<Entity>, TDetail> toDetailContract)
        where TDetail : class
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
            IEntityDetails details,
            CancellationToken cancellationToken) =>
        {
            var entity = await GetTypedMediaDetailAsync(id, kind, details, cancellationToken);
            if (entity is null)
            {
                return Results.NotFound(new ApiProblem(
                    $"{kind.Code}_not_found",
                    $"{tag} item '{id}' was not found."));
            }

            var childItems = children is null
                ? []
                : await entities.ListChildrenAsync(id, children.Value.Relationship, children.Value.ChildKind, cancellationToken);

            return Results.Ok(toDetailContract(entity, childItems));
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind.Code} media entity.")
            .Produces<TDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }

    private static async Task<Entity?> GetTypedMediaDetailAsync(
        Guid id,
        IEntityKind kind,
        IEntityDetails details,
        CancellationToken cancellationToken)
    {
        if (kind == EntityKindRegistry.Image)
        {
            return await details.GetImageAsync(id, cancellationToken);
        }

        if (kind == EntityKindRegistry.Gallery)
        {
            return await details.GetGalleryAsync(id, cancellationToken);
        }

        if (kind == EntityKindRegistry.Book)
        {
            return await details.GetBookAsync(id, cancellationToken);
        }

        if (kind == EntityKindRegistry.AudioLibrary)
        {
            return await details.GetAudioLibraryAsync(id, cancellationToken);
        }

        if (kind == EntityKindRegistry.AudioTrack)
        {
            return await details.GetAudioTrackAsync(id, cancellationToken);
        }

        return null;
    }
}
