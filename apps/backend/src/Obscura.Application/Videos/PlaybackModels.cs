using System.Text.Json.Serialization;

namespace Obscura.Application.Videos;

/// <summary>
/// Application request for Jellyfin-compatible playback negotiation.
/// </summary>
public sealed record PlaybackInfoQuery {
    public Guid? UserId { get; init; }
    public long? StartTimeTicks { get; init; }
    public int? AudioStreamIndex { get; init; }
    public int? SubtitleStreamIndex { get; init; }
    public int? MaxStreamingBitrate { get; init; }
    public bool? EnableDirectPlay { get; init; }
    public bool? EnableDirectStream { get; init; }
    public bool? EnableTranscoding { get; init; }
    public string? MediaSourceId { get; init; }
    public string? PlaySessionId { get; init; }
}

/// <summary>
/// Application result describing playable media sources for one playback session.
/// </summary>
public sealed record PlaybackInfoResult(
    string PlaySessionId,
    IReadOnlyList<MediaSourceInfoResult> MediaSources,
    string? ErrorCode = null);

/// <summary>
/// Application result describing one playable media source.
/// </summary>
public sealed record MediaSourceInfoResult(
    string Id,
    string Path,
    string Protocol,
    string? Container,
    long? Size,
    string? Name,
    long? RunTimeTicks,
    bool SupportsDirectPlay,
    bool SupportsDirectStream,
    bool SupportsTranscoding,
    string? TranscodingUrl,
    string? TranscodingSubProtocol,
    string? TranscodingContainer,
    IReadOnlyList<MediaStreamInfoResult> MediaStreams,
    TranscodingInfoResult? TranscodingInfo);

/// <summary>
/// Application result for one media stream.
/// </summary>
public sealed record MediaStreamInfoResult(
    int Index,
    string Type,
    string? Codec,
    string? Language,
    string? DisplayTitle,
    int? Width,
    int? Height,
    double? AverageFrameRate,
    int? BitRate,
    int? SampleRate,
    int? Channels,
    bool IsDefault = false,
    bool IsForced = false);

/// <summary>
/// Application result describing a selected transcoding strategy.
/// </summary>
public sealed record TranscodingInfoResult(
    string Container,
    string VideoCodec,
    string AudioCodec,
    string Protocol,
    bool IsVideoDirect,
    bool IsAudioDirect);

/// <summary>
/// Application command for Jellyfin-compatible playback session events.
/// </summary>
public sealed record PlaybackSessionCommand {
    public Guid ItemId { get; init; }
    public string? MediaSourceId { get; init; }
    public string? PlaySessionId { get; init; }
    public long? PositionTicks { get; init; }
    public bool? IsPaused { get; init; }
    public bool? IsMuted { get; init; }
}

/// <summary>
/// Application result for playback state returned by mark-played calls.
/// </summary>
public sealed record UserItemDataResult(
    bool Played,
    int? PlayCount = null,
    long? PlaybackPositionTicks = null);
