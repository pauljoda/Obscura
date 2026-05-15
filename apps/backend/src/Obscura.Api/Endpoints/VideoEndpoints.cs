using Obscura.Application.Videos;
using Obscura.Contracts.System;
using Obscura.Contracts.Videos;

namespace Obscura.Api.Endpoints;

public static class VideoEndpoints
{
    public static RouteGroupBuilder MapVideoEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/videos")
            .WithTags("Videos");

        group.MapGet("/", async (
            VideoService videos,
            CancellationToken cancellationToken) =>
            await videos.ListVideosAsync(cancellationToken))
            .WithName("ListVideos")
            .WithSummary("Lists video entities through the video domain facade.");

        group.MapGet("/{id:guid}", async (
            Guid id,
            VideoService videos,
            CancellationToken cancellationToken) =>
            {
                var video = await videos.GetVideoAsync(id, cancellationToken);

                return video is null
                    ? Results.NotFound(new ApiProblem(
                        "video_not_found",
                        $"Video '{id}' was not found."))
                    : Results.Ok(video);
            })
            .WithName("GetVideo")
            .WithSummary("Gets one video detail record.")
            .Produces<VideoDetail>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapGet("/{id:guid}/stream", StreamVideoAsync)
            .WithName("StreamVideo")
            .WithSummary("Streams the original video source when available.")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status206PartialContent)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound)
            .Produces<ApiProblem>(StatusCodes.Status415UnsupportedMediaType);

        group.MapMethods("/{id:guid}/stream", ["HEAD"], HeadVideoStreamAsync)
            .WithName("HeadVideoStream")
            .WithSummary("Returns headers for the original video source without opening a file stream.")
            .Produces(StatusCodes.Status200OK)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound)
            .Produces<ApiProblem>(StatusCodes.Status415UnsupportedMediaType)
            .ExcludeFromDescription();

        group.MapGet("/{id:guid}/hls/master.m3u8", (
            Guid id,
            IHlsAssetService hlsAssets,
            HttpContext httpContext,
            CancellationToken cancellationToken) =>
            StreamHlsAssetAsync(id, "master.m3u8", hlsAssets, httpContext, cancellationToken))
            .WithName("GetVideoHlsManifest")
            .WithSummary("Gets the adaptive HLS manifest for one video.")
            .Produces(StatusCodes.Status200OK)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapGet("/{id:guid}/hls/{**asset}", StreamHlsAssetAsync)
            .WithName("GetVideoHlsAsset")
            .WithSummary("Gets an adaptive HLS variant playlist or segment for one video.")
            .Produces(StatusCodes.Status200OK)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

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
            return Results.NotFound(new ApiProblem(
                "video_stream_not_found",
                $"Video stream '{id}' was not found."));
        }

        if (!source.DirectPlayable)
        {
            return Results.Json(
                new ApiProblem(
                    "video_stream_not_direct_playable",
                    "Direct playback is not available for this container."),
                statusCode: StatusCodes.Status415UnsupportedMediaType);
        }

        return Results.File(
            File.OpenRead(source.Path),
            source.ContentType,
            enableRangeProcessing: true);
    }

    private static async Task<IResult> HeadVideoStreamAsync(
        Guid id,
        IVideoSourceService sourceFiles,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        VideoSourceFile? source;
        try
        {
            // Media elements aggressively cancel duplicate HEAD probes while
            // choosing a provider. Do not let request-abort cancellation bubble
            // out of the source lookup and trip the debugger during normal
            // playback startup.
            source = await sourceFiles.GetSourceAsync(id, CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
            return Results.StatusCode(499);
        }

        if (source is null)
        {
            return Results.NotFound(new ApiProblem(
                "video_stream_not_found",
                $"Video stream '{id}' was not found."));
        }

        if (!source.DirectPlayable)
        {
            return Results.Json(
                new ApiProblem(
                    "video_stream_not_direct_playable",
                    "Direct playback is not available for this container."),
                statusCode: StatusCodes.Status415UnsupportedMediaType);
        }

        var fileInfo = new FileInfo(source.Path);
        httpContext.Response.ContentType = source.ContentType;
        httpContext.Response.ContentLength = fileInfo.Length;
        httpContext.Response.Headers.AcceptRanges = "bytes";
        return Results.Ok();
    }

    private static async Task<IResult> StreamHlsAssetAsync(
        Guid id,
        string asset,
        IHlsAssetService hlsAssets,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var hlsAsset = await hlsAssets.GetAssetAsync(id, asset, cancellationToken);
        if (hlsAsset is null)
        {
            return Results.NotFound(new ApiProblem(
                "video_hls_not_found",
                $"Video HLS asset '{asset}' for '{id}' was not found."));
        }

        httpContext.Response.Headers.CacheControl = hlsAsset.CacheControl;

        return Results.File(
            File.OpenRead(hlsAsset.Path),
            hlsAsset.ContentType,
            enableRangeProcessing: false);
    }
}
