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
/// API-facing video detail shape combining video metadata with shared entity capabilities.
/// </summary>
/// <param name="Id">Video entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Video title.</param>
/// <param name="Capabilities">Shared entity capabilities for the video.</param>
/// <param name="SubtitlesExtractedAt">When embedded subtitles were last extracted, when known.</param>
public sealed record VideoDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    DateTimeOffset? SubtitlesExtractedAt);
