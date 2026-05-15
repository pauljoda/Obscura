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
        var selectedAudioStream = SelectAudioStream(source, request?.AudioStreamIndex);
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
                ? BuildTranscodingUrl(itemId, mediaSourceId, playSessionId, selectedAudioStream?.StreamIndex)
                : null,
            transcodingAllowed && !directPlayAllowed ? "hls" : null,
            transcodingAllowed && !directPlayAllowed ? "ts" : null,
            BuildStreams(source, selectedAudioStream?.StreamIndex),
            transcodingAllowed && !directPlayAllowed
                ? new TranscodingInfo("ts", "h264", "aac", "hls", IsVideoDirect: false, IsAudioDirect: false)
                : null);

        return new PlaybackInfoResponse(playSessionId, [sourceInfo]);
    }

    private static string BuildTranscodingUrl(
        Guid itemId,
        string mediaSourceId,
        string playSessionId,
        int? audioStreamIndex)
    {
        var url = $"/Videos/{itemId:D}/live.m3u8?MediaSourceId={mediaSourceId}&PlaySessionId={playSessionId}";
        return audioStreamIndex is null ? url : $"{url}&AudioStreamIndex={audioStreamIndex.Value}";
    }

    private static VideoSourceStream? SelectAudioStream(VideoSourceFile source, int? requestedIndex)
    {
        var audioStreams = source.Streams?
            .Where(stream => stream.Type.Equals("Audio", StringComparison.OrdinalIgnoreCase))
            .OrderBy(stream => stream.StreamIndex)
            .ToList() ?? [];
        if (audioStreams.Count == 0)
        {
            return null;
        }

        return audioStreams.FirstOrDefault(stream => stream.StreamIndex == requestedIndex) ??
            audioStreams.FirstOrDefault(stream => stream.IsDefault) ??
            audioStreams[0];
    }

    private static IReadOnlyList<MediaStreamInfo> BuildStreams(
        VideoSourceFile source,
        int? selectedAudioStreamIndex)
    {
        if (source.Streams is { Count: > 0 })
        {
            return source.Streams
                .OrderBy(stream => stream.StreamIndex)
                .Select(stream => new MediaStreamInfo(
                    stream.StreamIndex,
                    stream.Type,
                    stream.Codec,
                    stream.Language,
                    StreamDisplayTitle(stream),
                    stream.Width,
                    stream.Height,
                    stream.FrameRate,
                    stream.BitRate,
                    stream.SampleRate,
                    stream.Channels,
                    IsDefault: StreamIsSelected(stream, selectedAudioStreamIndex),
                    IsForced: stream.IsForced))
                .ToList();
        }

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

    private static string StreamDisplayTitle(VideoSourceStream stream)
    {
        if (!string.IsNullOrWhiteSpace(stream.Title))
        {
            return stream.Title!;
        }

        if (stream.Type.Equals("Audio", StringComparison.OrdinalIgnoreCase))
        {
            var language = string.IsNullOrWhiteSpace(stream.Language) ? "Audio" : stream.Language!.ToUpperInvariant();
            var channels = stream.Channels is > 0 ? $" · {stream.Channels}ch" : "";
            return $"{language}{channels}";
        }

        return stream.Type;
    }

    private static bool StreamIsSelected(VideoSourceStream stream, int? selectedAudioStreamIndex)
    {
        if (!stream.Type.Equals("Audio", StringComparison.OrdinalIgnoreCase) ||
            selectedAudioStreamIndex is null)
        {
            return stream.IsDefault;
        }

        return stream.StreamIndex == selectedAudioStreamIndex.Value;
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
