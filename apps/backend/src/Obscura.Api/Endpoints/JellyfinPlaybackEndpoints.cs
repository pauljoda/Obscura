using Obscura.Application.Videos;
using Obscura.Contracts.Playback;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

public static class JellyfinPlaybackEndpoints
{
    public static IEndpointRouteBuilder MapJellyfinPlaybackEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/Items/{itemId:guid}/PlaybackInfo", (
            Guid itemId,
            IPlaybackInfoService playback,
            CancellationToken cancellationToken) =>
            GetPlaybackInfoAsync(itemId, playback, null, cancellationToken))
            .WithName("GetJellyfinPlaybackInfo")
            .WithTags("Jellyfin Playback")
            .Produces<PlaybackInfoResponse>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        routes.MapPost("/Items/{itemId:guid}/PlaybackInfo", (
            Guid itemId,
            PlaybackInfoRequest request,
            IPlaybackInfoService playback,
            CancellationToken cancellationToken) =>
            GetPlaybackInfoAsync(itemId, playback, request, cancellationToken))
            .WithName("PostJellyfinPlaybackInfo")
            .WithTags("Jellyfin Playback")
            .Produces<PlaybackInfoResponse>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        routes.MapMethods("/Videos/{itemId:guid}/stream", [HttpMethods.Get, HttpMethods.Head], StreamVideoAsync)
            .WithName("GetJellyfinVideoStream")
            .WithTags("Jellyfin Videos")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status206PartialContent)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound)
            .Produces<ApiProblem>(StatusCodes.Status415UnsupportedMediaType);

        routes.MapGet("/Videos/{itemId:guid}/live.m3u8", (
            Guid itemId,
            IHlsAssetService hlsAssets,
            HttpContext httpContext,
            CancellationToken cancellationToken) =>
            StreamHlsAssetAsync(itemId, "master.m3u8", hlsAssets, httpContext, cancellationToken))
            .WithName("GetJellyfinVideoLivePlaylist")
            .WithTags("Jellyfin Videos");

        routes.MapGet("/Videos/{itemId:guid}/hls/{playlistId}/{segmentId}.{container}", (
            Guid itemId,
            string playlistId,
            string segmentId,
            string container,
            IHlsAssetService hlsAssets,
            HttpContext httpContext,
            CancellationToken cancellationToken) =>
            StreamHlsAssetAsync(itemId, $"v/{playlistId}/{segmentId}.{container}", hlsAssets, httpContext, cancellationToken))
            .WithName("GetJellyfinVideoHlsSegment")
            .WithTags("Jellyfin Videos");

        routes.MapGet("/Videos/{itemId:guid}/v/{playlistId}/{segmentId}.{container}", (
            Guid itemId,
            string playlistId,
            string segmentId,
            string container,
            IHlsAssetService hlsAssets,
            HttpContext httpContext,
            CancellationToken cancellationToken) =>
            StreamHlsAssetAsync(itemId, $"v/{playlistId}/{segmentId}.{container}", hlsAssets, httpContext, cancellationToken))
            .WithName("GetJellyfinVideoHlsRelativeAsset")
            .WithTags("Jellyfin Videos");

        routes.MapDelete("/Videos/ActiveEncodings", async (
            ITranscodeSessionService transcodes,
            CancellationToken cancellationToken) =>
        {
            var killed = await transcodes.CancelAllAsync(cancellationToken);
            return Results.Ok(new { killed });
        })
            .WithName("DeleteJellyfinActiveEncodings")
            .WithTags("Jellyfin Videos");

        routes.MapGet("/Videos/{itemId:guid}/Trickplay/{width:int}/tiles.m3u8", GetTrickplayPlaylistAsync)
            .WithName("GetJellyfinTrickplayPlaylist")
            .WithTags("Jellyfin Videos");

        routes.MapGet("/Videos/{itemId:guid}/Trickplay/{width:int}/{index:int}.jpg", GetTrickplayTileAsync)
            .WithName("GetJellyfinTrickplayTile")
            .WithTags("Jellyfin Videos");

        routes.MapPost("/Sessions/Playing", async (
            PlaybackSessionRequest request,
            IPlaybackSessionService sessions,
            CancellationToken cancellationToken) =>
        {
            await sessions.StartAsync(request, cancellationToken);
            return Results.NoContent();
        })
            .WithName("PostJellyfinSessionPlaying")
            .WithTags("Jellyfin Sessions");

        routes.MapPost("/Sessions/Playing/Progress", async (
            PlaybackSessionRequest request,
            IPlaybackSessionService sessions,
            CancellationToken cancellationToken) =>
        {
            await sessions.ProgressAsync(request, cancellationToken);
            return Results.NoContent();
        })
            .WithName("PostJellyfinSessionProgress")
            .WithTags("Jellyfin Sessions");

        routes.MapPost("/Sessions/Playing/Ping", async (
            PlaybackSessionRequest request,
            IPlaybackSessionService sessions,
            CancellationToken cancellationToken) =>
        {
            await sessions.PingAsync(request, cancellationToken);
            return Results.NoContent();
        })
            .WithName("PostJellyfinSessionPing")
            .WithTags("Jellyfin Sessions");

        routes.MapPost("/Sessions/Playing/Stopped", async (
            PlaybackSessionRequest request,
            IPlaybackSessionService sessions,
            CancellationToken cancellationToken) =>
        {
            await sessions.StopAsync(request, cancellationToken);
            return Results.NoContent();
        })
            .WithName("PostJellyfinSessionStopped")
            .WithTags("Jellyfin Sessions");

        routes.MapPost("/UserPlayedItems/{itemId:guid}", async (
            Guid itemId,
            IPlaybackSessionService sessions,
            CancellationToken cancellationToken) =>
            await MarkPlayedAsync(itemId, sessions, cancellationToken))
            .WithName("PostJellyfinUserPlayedItem")
            .WithTags("Jellyfin Sessions");

        routes.MapDelete("/UserPlayedItems/{itemId:guid}", async (
            Guid itemId,
            IPlaybackSessionService sessions,
            CancellationToken cancellationToken) =>
            await MarkUnplayedAsync(itemId, sessions, cancellationToken))
            .WithName("DeleteJellyfinUserPlayedItem")
            .WithTags("Jellyfin Sessions");

        return routes;
    }

    private static async Task<IResult> GetPlaybackInfoAsync(
        Guid itemId,
        IPlaybackInfoService playback,
        PlaybackInfoRequest? request,
        CancellationToken cancellationToken)
    {
        var info = await playback.GetPlaybackInfoAsync(itemId, request, cancellationToken);
        return info is null
            ? Results.NotFound(new ApiProblem("playback_source_not_found", $"Item '{itemId}' has no playable source."))
            : Results.Ok(info);
    }

    private static async Task<IResult> StreamVideoAsync(
        Guid itemId,
        IVideoSourceService sourceFiles,
        CancellationToken cancellationToken)
    {
        var source = await sourceFiles.GetSourceAsync(itemId, cancellationToken);
        if (source is null)
        {
            return Results.NotFound(new ApiProblem("video_stream_not_found", $"Video stream '{itemId}' was not found."));
        }

        if (!source.DirectPlayable)
        {
            return Results.Json(
                new ApiProblem("video_stream_not_direct_playable", "Direct playback is not available for this container."),
                statusCode: StatusCodes.Status415UnsupportedMediaType);
        }

        return Results.File(File.OpenRead(source.Path), source.ContentType, enableRangeProcessing: true);
    }

    private static async Task<IResult> StreamHlsAssetAsync(
        Guid itemId,
        string asset,
        IHlsAssetService hlsAssets,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var hlsAsset = await hlsAssets.GetAssetAsync(itemId, asset, cancellationToken);
        if (hlsAsset is null)
        {
            return Results.NotFound(new ApiProblem("video_hls_not_found", $"Video HLS asset '{asset}' for '{itemId}' was not found."));
        }

        httpContext.Response.Headers.CacheControl = hlsAsset.CacheControl;
        return Results.File(File.OpenRead(hlsAsset.Path), hlsAsset.ContentType, enableRangeProcessing: false);
    }

    private static async Task<IResult> GetTrickplayPlaylistAsync(
        Guid itemId,
        int width,
        ITrickplayService trickplay,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var playlist = await trickplay.GetPlaylistAsync(itemId, width, cancellationToken);
        if (playlist is null)
        {
            return Results.NotFound(new ApiProblem("video_trickplay_not_found", $"Trickplay width '{width}' for '{itemId}' was not found."));
        }

        httpContext.Response.Headers.CacheControl = playlist.CacheControl;
        return Results.Text(playlist.Content, "application/vnd.apple.mpegurl");
    }

    private static async Task<IResult> GetTrickplayTileAsync(
        Guid itemId,
        int width,
        int index,
        ITrickplayService trickplay,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var tile = await trickplay.GetTileAsync(itemId, width, index, cancellationToken);
        if (tile is null)
        {
            return Results.NotFound(new ApiProblem("video_trickplay_tile_not_found", $"Trickplay tile '{index}' for '{itemId}' was not found."));
        }

        httpContext.Response.Headers.CacheControl = tile.CacheControl;
        return Results.File(File.OpenRead(tile.Path), tile.ContentType, enableRangeProcessing: false);
    }

    private static async Task<IResult> MarkPlayedAsync(
        Guid itemId,
        IPlaybackSessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.MarkPlayedAsync(itemId, cancellationToken);
        return result is null
            ? Results.NotFound(new ApiProblem("playback_item_not_found", $"Item '{itemId}' was not found."))
            : Results.Ok(result);
    }

    private static async Task<IResult> MarkUnplayedAsync(
        Guid itemId,
        IPlaybackSessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.MarkUnplayedAsync(itemId, cancellationToken);
        return result is null
            ? Results.NotFound(new ApiProblem("playback_item_not_found", $"Item '{itemId}' was not found."))
            : Results.Ok(result);
    }
}
