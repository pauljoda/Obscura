using Obscura.Contracts.System;
using Obscura.Contracts.Videos;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.Videos;

namespace Obscura.Api.Endpoints;

public static class VideoEndpoints
{
    public static RouteGroupBuilder MapVideoEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/videos")
            .WithTags("Videos");

        group.MapGet("/", async (
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
            await entities.ListVideosAsync(cancellationToken))
            .WithName("ListVideos")
            .WithSummary("Lists video entities through the video domain facade.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityProjectionService entities,
            CancellationToken cancellationToken) =>
            {
                var video = await entities.GetVideoAsync(id, cancellationToken);

                return video is null
                    ? Results.NotFound(new ProblemDetailsDto(
                        "video_not_found",
                        $"Video '{id}' was not found."))
                    : Results.Ok(video);
            })
            .WithName("GetVideo")
            .WithSummary("Gets one video detail record.")
            .Produces<VideoDetailDto>()
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound);

        group.MapGet("/{id:guid}/stream", StreamVideoAsync)
            .WithName("StreamVideo")
            .WithSummary("Streams the original video source when available.")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status206PartialContent)
            .Produces<ProblemDetailsDto>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetailsDto>(StatusCodes.Status415UnsupportedMediaType);

        group.MapGet("/{id:guid}/hls/master.m3u8", (Guid id) =>
            Results.NotFound(new ProblemDetailsDto(
                "video_hls_not_found",
                $"Video HLS package '{id}' was not found.")))
            .WithName("GetVideoHlsManifest")
            .WithSummary("Gets the adaptive HLS manifest for one video.");

        return group;
    }

    private static async Task<IResult> StreamVideoAsync(
        Guid id,
        IVideoSourceService sourceFiles,
        CancellationToken cancellationToken)
    {
        var source = await sourceFiles.GetSourceAsync(id, cancellationToken);

        if (source is null)
        {
            return Results.NotFound(new ProblemDetailsDto(
                "video_stream_not_found",
                $"Video stream '{id}' was not found."));
        }

        if (!source.DirectPlayable)
        {
            return Results.Json(
                new ProblemDetailsDto(
                    "video_stream_not_direct_playable",
                    "Direct playback is not available for this container."),
                statusCode: StatusCodes.Status415UnsupportedMediaType);
        }

        return Results.File(
            File.OpenRead(source.Path),
            source.ContentType,
            enableRangeProcessing: true);
    }
}
