using Obscura.Application.Videos;
using Obscura.Contracts.Playback;

namespace Obscura.Infrastructure.Videos;

/// <summary>
/// Clean-room Jellyfin-shaped playback negotiator backed by Obscura's current source file resolver.
/// </summary>
public sealed class PlaybackInfoService : IPlaybackInfoService
{
    private readonly IVideoSourceService _sources;
    private readonly ITranscodeSessionService _transcodes;

    public PlaybackInfoService(IVideoSourceService sources, ITranscodeSessionService transcodes)
    {
        _sources = sources;
        _transcodes = transcodes;
    }

    /// <inheritdoc />
    public async Task<PlaybackInfoResponse?> GetPlaybackInfoAsync(
        Guid itemId,
        PlaybackInfoRequest? request,
        CancellationToken cancellationToken)
    {
        var source = await _sources.GetSourceAsync(itemId, cancellationToken);
        if (source is null)
        {
            return null;
        }

        var playSessionId = string.IsNullOrWhiteSpace(request?.PlaySessionId)
            ? Guid.NewGuid().ToString("N")
            : request.PlaySessionId!;
        var directPlayAllowed = request?.EnableDirectPlay != false && source.DirectPlayable;
        var transcodingAllowed = request?.EnableTranscoding != false;
        var mediaSourceId = (source.MediaSourceId ?? itemId).ToString("N");

        if (transcodingAllowed)
        {
            _transcodes.Register(playSessionId, itemId);
        }

        var fileInfo = new FileInfo(source.Path);
        var sourceInfo = new MediaSourceInfo(
            mediaSourceId,
            source.Path,
            "File",
            source.Container ?? ContainerFromPath(source.Path),
            fileInfo.Exists ? fileInfo.Length : null,
            Path.GetFileName(source.Path),
            ToTicks(source.DurationSeconds),
            directPlayAllowed,
            source.DirectPlayable,
            transcodingAllowed,
            transcodingAllowed && !directPlayAllowed
                ? $"/Videos/{itemId:D}/live.m3u8?MediaSourceId={mediaSourceId}&PlaySessionId={playSessionId}"
                : null,
            transcodingAllowed && !directPlayAllowed ? "hls" : null,
            transcodingAllowed && !directPlayAllowed ? "ts" : null,
            BuildStreams(source),
            transcodingAllowed && !directPlayAllowed
                ? new TranscodingInfo("ts", "h264", "aac", "hls", IsVideoDirect: false, IsAudioDirect: false)
                : null);

        return new PlaybackInfoResponse(playSessionId, [sourceInfo]);
    }

    private static IReadOnlyList<MediaStreamInfo> BuildStreams(VideoSourceFile source)
    {
        var videoStream = new MediaStreamInfo(
            0,
            "Video",
            source.VideoCodec ?? CodecFromContentType(source.ContentType),
            null,
            "Video",
            source.Width,
            source.Height,
            source.FrameRate,
            source.BitRate,
            null,
            null,
            IsDefault: true);

        if (source.AudioCodec is null && source.SampleRate is null && source.Channels is null)
        {
            return [videoStream];
        }

        var audioStream = new MediaStreamInfo(
            1,
            "Audio",
            source.AudioCodec,
            null,
            "Audio",
            null,
            null,
            null,
            null,
            source.SampleRate,
            source.Channels,
            IsDefault: true);

        return [videoStream, audioStream];
    }

    private static string? CodecFromContentType(string contentType) =>
        contentType.Equals("video/mp4", StringComparison.OrdinalIgnoreCase) ? "h264" : null;

    private static string? ContainerFromPath(string path)
    {
        var extension = Path.GetExtension(path).TrimStart('.').ToLowerInvariant();
        return string.IsNullOrWhiteSpace(extension) ? null : extension;
    }

    private static long? ToTicks(double? seconds) =>
        seconds is > 0 ? (long)Math.Round(seconds.Value * TimeSpan.TicksPerSecond) : null;
}
