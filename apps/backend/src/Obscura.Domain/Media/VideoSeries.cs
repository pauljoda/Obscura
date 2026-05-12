using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Video-series entity extension with projected child groupings and playable videos.
/// </summary>
/// <param name="Id">Shared global entity identifier.</param>
/// <param name="Title">Display title inherited from the shared entity root.</param>
/// <param name="Subtitle">Optional display subtitle inherited from the shared entity root.</param>
/// <param name="Summary">Series synopsis or freeform details.</param>
/// <param name="RenderingMode">How the series should present episodes and seasons.</param>
/// <param name="Children">Non-video child groupings such as seasons, once they are projected.</param>
/// <param name="Videos">Playable video entities linked to the series.</param>
public sealed record VideoSeries(
    Guid Id,
    string Title,
    string? Subtitle,
    string? Summary,
    VideoSeriesRenderingMode RenderingMode,
    IReadOnlyList<Entity> Children,
    IReadOnlyList<Entity> Videos)
    : Entity(
        Id,
        EntityKindRegistry.VideoSeries,
        Title,
        Subtitle,
        [
            new CapabilityRating(null),
            CapabilityTags.Empty,
            CapabilityCredits.Empty,
            new CapabilityStudio(null),
            CapabilityImages.Empty,
            CapabilityLinks.Empty,
            CapabilityFlags.Empty,
            CapabilityFiles.Empty
        ])
{
    /// <summary>
    /// Creates a video series from the broader detail value object used by persistence hydration.
    /// </summary>
    public VideoSeries(
        Entity entity,
        VideoSeriesDetails details,
        IReadOnlyList<Entity> children,
        IReadOnlyList<Entity> videos)
        : this(
            entity.Id,
            entity.Title,
            entity.Subtitle,
            details.Overview,
            details.RenderingMode,
            children,
            videos)
    {
        Capabilities = entity.Capabilities;
        Details = details;
    }

    /// <summary>Full hydrated series detail fields when loaded from persistence.</summary>
    public VideoSeriesDetails Details { get; init; } = VideoSeriesDetails.Empty with
    {
        Overview = Summary,
        RenderingMode = RenderingMode
    };
}

/// <summary>
/// Video-series-specific metadata that should not live on every entity.
/// </summary>
public sealed record VideoSeriesDetails(
    Guid? LibraryRootId,
    string? FolderPath,
    string? RelativePath,
    string? SortTitle,
    string? OriginalTitle,
    string? Overview,
    string? Tagline,
    string? Status,
    string? FirstAirDate,
    string? EndAirDate,
    string? ContentRating,
    VideoSeriesRenderingMode RenderingMode)
{
    /// <summary>
    /// Empty series details used before scan or provider metadata is attached.
    /// </summary>
    public static VideoSeriesDetails Empty { get; } = new(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        VideoSeriesRenderingMode.Flat);
}

/// <summary>
/// Structural video-season aggregate for season-grouped video series.
/// </summary>
public sealed record VideoSeason(
    Guid Id,
    string Title,
    string? Subtitle,
    VideoSeasonDetails Details)
    : Entity(
        Id,
        EntityKindRegistry.VideoSeason,
        Title,
        Subtitle,
        [
            new CapabilityRating(null),
            CapabilityTags.Empty,
            CapabilityCredits.Empty,
            new CapabilityStudio(null),
            CapabilityImages.Empty,
            CapabilityLinks.Empty,
            CapabilityFlags.Empty,
            CapabilityFiles.Empty
        ])
{
    /// <summary>
    /// Creates a video season from an already hydrated entity root.
    /// </summary>
    public VideoSeason(Entity entity, VideoSeasonDetails details)
        : this(entity.Id, entity.Title, entity.Subtitle, details)
    {
        Capabilities = entity.Capabilities;
    }
}

/// <summary>
/// Video-season-specific hierarchy and descriptive metadata.
/// </summary>
public sealed record VideoSeasonDetails(
    Guid SeriesId,
    int SeasonNumber,
    string? FolderPath,
    string? Overview,
    string? AirDate)
{
    /// <summary>
    /// Empty season details used before hierarchy metadata is attached.
    /// </summary>
    public static VideoSeasonDetails Empty { get; } = new(Guid.Empty, 0, null, null, null);
}
