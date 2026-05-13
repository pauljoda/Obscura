using Obscura.Application.Entities;
using Obscura.Application.Media;
using Obscura.Contracts.Media;
using Obscura.Contracts.System;
using Obscura.Domain.Entities;

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
            (media, query, cancellationToken) => media.ListImagesAsync(query, cancellationToken),
            (media, id, cancellationToken) => media.GetImageAsync(id, cancellationToken));
        MapMediaGroup<GalleryDetail>(
            routes,
            "/api/galleries",
            "Galleries",
            EntityKindRegistry.Gallery,
            (media, query, cancellationToken) => media.ListGalleriesAsync(query, cancellationToken),
            (media, id, cancellationToken) => media.GetGalleryAsync(id, cancellationToken));
        MapMediaGroup<BookDetail>(
            routes,
            "/api/books",
            "Books",
            EntityKindRegistry.Book,
            (media, query, cancellationToken) => media.ListBooksAsync(query, cancellationToken),
            (media, id, cancellationToken) => media.GetBookAsync(id, cancellationToken));
        MapMediaGroup<AudioLibraryDetail>(
            routes,
            "/api/audio-libraries",
            "AudioLibraries",
            EntityKindRegistry.AudioLibrary,
            (media, query, cancellationToken) => media.ListAudioLibrariesAsync(query, cancellationToken),
            (media, id, cancellationToken) => media.GetAudioLibraryAsync(id, cancellationToken));
        MapMediaGroup<AudioTrackDetail>(
            routes,
            "/api/audio-tracks",
            "AudioTracks",
            EntityKindRegistry.AudioTrack,
            (media, query, cancellationToken) => media.ListAudioTracksAsync(query, cancellationToken),
            (media, id, cancellationToken) => media.GetAudioTrackAsync(id, cancellationToken));

        return routes;
    }

    private static void MapMediaGroup<TDetail>(
        IEndpointRouteBuilder routes,
        string path,
        string tag,
        IEntityKind kind,
        Func<MediaService, EntityListQuery, CancellationToken, Task<MediaListResponse>> list,
        Func<MediaService, Guid, CancellationToken, Task<TDetail?>> get)
        where TDetail : class
    {
        var group = routes.MapGroup(path)
            .WithTags(tag);

        group.MapGet("/", async (
            string? query,
            string? cursor,
            MediaService media,
            CancellationToken cancellationToken) =>
        {
            return await list(media, new EntityListQuery(null, query, cursor), cancellationToken);
        })
            .WithName($"List{tag}")
            .WithSummary($"Lists {kind.Code} media entities through the application layer.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            MediaService media,
            CancellationToken cancellationToken) =>
        {
            var detail = await get(media, id, cancellationToken);
            return detail is null
                ? Results.NotFound(new ApiProblem(
                    $"{kind.Code}_not_found",
                    $"{tag} item '{id}' was not found."))
                : Results.Ok(detail);
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind.Code} media entity through the application layer.")
            .Produces<TDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
    }
}
