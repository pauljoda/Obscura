using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Series;

/// <summary>
/// Cursor-paged response for video-series browsing.
/// </summary>
/// <param name="Items">Current page of series cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record VideoSeriesListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

/// <summary>
/// API-facing video-series detail shape with projected child videos.
/// </summary>
/// <param name="Id">Series entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Series title.</param>
/// <param name="Capabilities">Shared entity capabilities for the series.</param>
/// <param name="Children">Non-video child groupings, such as seasons, when available.</param>
/// <param name="Videos">Playable video cards linked to the series.</param>
/// <param name="RenderingMode">UI hint for flat or grouped rendering.</param>
public sealed record VideoSeriesDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityCard> Children,
    IReadOnlyList<EntityCard> Videos,
    string RenderingMode);

/// <summary>
/// API-facing video-season detail shape with ordered episode videos.
/// </summary>
/// <param name="Id">Season entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Season title.</param>
/// <param name="Capabilities">Shared entity capabilities for the season.</param>
/// <param name="SeriesId">Parent series entity identifier.</param>
/// <param name="Videos">Playable episode cards linked to the season in hierarchy order.</param>
public sealed record VideoSeasonDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    Guid SeriesId,
    IReadOnlyList<EntityCard> Videos);
