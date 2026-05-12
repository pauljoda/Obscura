using Obscura.Contracts.System;
using Obscura.Contracts.Videos;

namespace Obscura.Api.Endpoints;

public static class VideoEndpoints
{
    public static RouteGroupBuilder MapVideoEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/videos")
            .WithTags("Videos");

        group.MapGet("/", () => new VideoListResponseDto([], null))
            .WithName("ListVideos")
            .WithSummary("Lists video entities through the video domain facade.");

        group.MapGet("/{id:guid}", (Guid id) =>
            Results.NotFound(new ProblemDetailsDto(
                "video_not_found",
                $"Video '{id}' was not found.")))
            .WithName("GetVideo")
            .WithSummary("Gets one video detail record.");

        group.MapGet("/{id:guid}/stream", (Guid id) =>
            Results.NotFound(new ProblemDetailsDto(
                "video_stream_not_found",
                $"Video stream '{id}' was not found.")))
            .WithName("StreamVideo")
            .WithSummary("Streams the original video source when available.");

        group.MapGet("/{id:guid}/hls/master.m3u8", (Guid id) =>
            Results.NotFound(new ProblemDetailsDto(
                "video_hls_not_found",
                $"Video HLS package '{id}' was not found.")))
            .WithName("GetVideoHlsManifest")
            .WithSummary("Gets the adaptive HLS manifest for one video.");

        return group;
    }
}
