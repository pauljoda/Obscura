using Obscura.Contracts.Media;
using Obscura.Contracts.System;
using Obscura.Infrastructure.Entities;

namespace Obscura.Api.Endpoints;

public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder routes)
    {
        MapMediaGroup(routes, "/api/images", "Images", "image");
        MapMediaGroup(routes, "/api/galleries", "Galleries", "gallery");
        MapMediaGroup(routes, "/api/books", "Books", "book");
        MapMediaGroup(routes, "/api/audio-libraries", "AudioLibraries", "audio-library");
        MapMediaGroup(routes, "/api/audio-tracks", "AudioTracks", "audio-track");

        return routes;
    }

    private static void MapMediaGroup(
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
            return new MediaListResponseDto(response.Items, response.NextCursor);
        })
            .WithName($"List{tag}")
            .WithSummary($"Lists {kind} media entities through the global entity projection.");

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
                    $"{tag} item '{id}' was not found."));
            }

            return Results.Ok(new MediaDetailDto(
                entity.Id,
                entity.Kind,
                entity.Title,
                entity.Capabilities));
        })
            .WithName($"Get{tag.TrimEnd('s')}")
            .WithSummary($"Gets one {kind} media entity.")
            .Produces<MediaDetailDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);
    }
}
