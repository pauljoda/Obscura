using Obscura.Application.Entities;
using Obscura.Contracts.Collections;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;
using Obscura.Contracts.Series;
using Obscura.Contracts.System;
using Obscura.Contracts.Taxonomy;
using Obscura.Contracts.Videos;
using Obscura.Domain.Entities;

namespace Obscura.Api.Endpoints;

public static class EntityEndpoints
{
    public static IEndpointRouteBuilder MapEntityEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/entities")
            .WithTags("Entities");

        group.MapGet("/", async (
            string? query,
            string? cursor,
            bool? hideNsfw,
            HttpContext httpContext,
            IEntityReadUseCases entities,
            CancellationToken cancellationToken) =>
        {
            if (!TryGetKind(httpContext.Request.Query["kind"].ToString(), out var kind, out var error))
            {
                return error;
            }

            return Results.Ok(await entities.ListAsync(kind, query, cursor, hideNsfw, cancellationToken));
        })
            .WithName("ListEntities")
            .Produces<EntityListResponse>()
            .Produces<ApiProblem>(StatusCodes.Status400BadRequest);

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityReadUseCases entities,
            CancellationToken cancellationToken) =>
            await GetEntityAsync(id, entities, cancellationToken))
            .WithName("GetEntity")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPost("/thumbnails", async (
            EntityThumbnailBatchRequest request,
            IEntityReadUseCases entities,
            CancellationToken cancellationToken) =>
            Results.Ok(await entities.GetThumbnailsAsync(request.Ids, cancellationToken)))
            .WithName("GetEntityThumbnails")
            .Produces<EntityThumbnailBatchResponse>();

        routes.MapEntityKindRoutes("/api/videos", "video", "Videos", "ListVideos", "GetVideo", typeof(VideoListResponse), typeof(VideoDetail));
        routes.MapEntityKindRoutes("/api/series", "series", "Series", "ListVideoSeries", "GetVideoSeries", typeof(VideoSeriesListResponse), typeof(VideoSeriesDetail));
        routes.MapGet("/api/series/{id:guid}/seasons/{seasonId:guid}", async (
            Guid id,
            Guid seasonId,
            IEntityReadUseCases entities,
            CancellationToken cancellationToken) =>
            await GetKindDetailAsync(seasonId, "season", entities, cancellationToken))
            .WithTags("Series")
            .WithName("GetVideoSeason")
            .Produces<VideoSeasonDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);
        routes.MapEntityKindRoutes("/api/images", "image", "Images", "ListImages", "GetImage", typeof(MediaListResponse), typeof(ImageDetail));
        routes.MapEntityKindRoutes("/api/galleries", "gallery", "Galleries", "ListGalleries", "GetGallery", typeof(MediaListResponse), typeof(GalleryDetail));
        routes.MapEntityKindRoutes("/api/books", "book", "Books", "ListBooks", "GetBook", typeof(MediaListResponse), typeof(BookDetail));
        routes.MapEntityKindRoutes("/api/audio-libraries", "audio-library", "Audio", "ListAudioLibraries", "GetAudioLibrary", typeof(MediaListResponse), typeof(AudioLibraryDetail));
        routes.MapEntityKindRoutes("/api/audio-tracks", "audio-track", "Audio", "ListAudioTracks", "GetAudioTrack", typeof(MediaListResponse), typeof(AudioTrackDetail));
        routes.MapEntityKindRoutes("/api/people", "person", "Taxonomy", "ListPeople", "GetPerson", typeof(TaxonomyListResponse), typeof(PersonDetail));
        routes.MapEntityKindRoutes("/api/studios", "studio", "Taxonomy", "ListStudios", "GetStudio", typeof(TaxonomyListResponse), typeof(StudioDetail));
        routes.MapEntityKindRoutes("/api/tags", "tag", "Taxonomy", "ListTags", "GetTag", typeof(TaxonomyListResponse), typeof(TagDetail));
        routes.MapEntityKindRoutes("/api/collections", "collection", "Collections", "ListCollections", "GetCollection", typeof(CollectionListResponse), typeof(CollectionDetail));

        return routes;
    }

    private static RouteGroupBuilder MapEntityKindRoutes(
        this IEndpointRouteBuilder routes,
        string prefix,
        string kind,
        string tag,
        string listName,
        string detailName,
        Type listResponseType,
        Type detailResponseType)
    {
        var group = routes.MapGroup(prefix)
            .WithTags(tag);

        group.MapGet("/", async (
            string? query,
            string? cursor,
            bool? hideNsfw,
            IEntityReadUseCases entities,
            CancellationToken cancellationToken) =>
            Results.Ok(await entities.ListAsync(kind, query, cursor, hideNsfw, cancellationToken)))
            .WithName(listName)
            .Produces(StatusCodes.Status200OK, listResponseType);

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityReadUseCases entities,
            CancellationToken cancellationToken) =>
            await GetKindDetailAsync(id, kind, entities, cancellationToken))
            .WithName(detailName)
            .Produces(StatusCodes.Status200OK, detailResponseType)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }

    private static async Task<IResult> GetEntityAsync(
        Guid id,
        IEntityReadUseCases entities,
        CancellationToken cancellationToken)
    {
        var entity = await entities.GetAsync(id, cancellationToken);
        return entity is null
            ? Results.NotFound(new ApiProblem("entity_not_found", $"Entity '{id}' was not found."))
            : Results.Ok(entity);
    }

    private static async Task<IResult> GetKindDetailAsync(
        Guid id,
        string kind,
        IEntityReadUseCases entities,
        CancellationToken cancellationToken)
    {
        var entity = await entities.GetDetailAsync(id, kind, cancellationToken);
        return entity is null
            ? Results.NotFound(new ApiProblem("entity_not_found", $"Entity '{id}' was not found."))
            : Results.Ok(entity);
    }

    private static bool TryGetKind(string? value, out string? kind, out IResult error)
    {
        kind = null;
        error = Results.Empty;
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        if (EntityKindRegistry.TryGet(value, out var resolved))
        {
            kind = resolved.ToCode();
            return true;
        }

        error = Results.BadRequest(new ApiProblem("invalid_entity_kind", $"Entity kind '{value}' is not recognized."));
        return false;
    }
}
