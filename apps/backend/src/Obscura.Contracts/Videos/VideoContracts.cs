using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Videos;

/// <summary>
/// Cursor-paged response for video browsing.
/// </summary>
/// <param name="Items">Current page of video cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record VideoListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

/// <summary>
/// API-facing marker in a video's timeline.
/// </summary>
/// <param name="Id">Marker identifier.</param>
/// <param name="Title">Marker label.</param>
/// <param name="Seconds">Start time in seconds.</param>
/// <param name="EndSeconds">Optional end time in seconds.</param>
public sealed record VideoMarker(
    Guid Id,
    string Title,
    double Seconds,
    double? EndSeconds);

/// <summary>
/// API-facing subtitle track available during video playback.
/// </summary>
/// <param name="Id">Subtitle track identifier.</param>
/// <param name="Language">Subtitle language code.</param>
/// <param name="Label">Optional display label.</param>
/// <param name="Format">Served subtitle format.</param>
/// <param name="Source">Source or importer that produced the subtitle.</param>
/// <param name="StoragePath">Path to the normalized served subtitle file.</param>
/// <param name="SourceFormat">Original subtitle format before normalization.</param>
/// <param name="SourcePath">Optional path to the original subtitle file.</param>
/// <param name="IsDefault">Whether this track should be selected by default.</param>
public sealed record VideoSubtitle(
    Guid Id,
    string Language,
    string? Label,
    string Format,
    string Source,
    string StoragePath,
    string SourceFormat,
    string? SourcePath,
    bool IsDefault);

/// <summary>
/// API-facing video detail shape combining video metadata with shared entity capabilities.
/// </summary>
/// <param name="Id">Video entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Video title.</param>
/// <param name="Description">Optional canonical description.</param>
/// <param name="Duration">Runtime when known.</param>
/// <param name="Width">Source width in pixels when known.</param>
/// <param name="Height">Source height in pixels when known.</param>
/// <param name="Markers">Timeline markers attached to the video.</param>
/// <param name="Subtitles">Subtitle tracks available for playback.</param>
/// <param name="Capabilities">Shared entity capabilities for the video.</param>
public sealed record VideoDetail(
    Guid Id,
    string Kind,
    string Title,
    string? Description,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    IReadOnlyList<VideoMarker> Markers,
    IReadOnlyList<VideoSubtitle> Subtitles,
    IReadOnlyList<EntityCapability> Capabilities);
