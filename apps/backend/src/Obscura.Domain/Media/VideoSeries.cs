using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for a video series plus its projected child entities and playable videos.
/// </summary>
/// <param name="Entity">Shared global entity root for the series.</param>
/// <param name="Details">Series-specific descriptive metadata.</param>
/// <param name="Children">Non-video child groupings such as seasons, once they are projected.</param>
/// <param name="Videos">Playable video entities linked to the series.</param>
public sealed record VideoSeries(
    Entity Entity,
    VideoSeriesDetails Details,
    IReadOnlyList<Entity> Children,
    IReadOnlyList<Entity> Videos)
{
    /// <summary>Optional series summary.</summary>
    public string? Summary => Details.Overview;

    /// <summary>UI hint describing whether the series should render as flat or season-grouped.</summary>
    public VideoSeriesRenderingMode RenderingMode => Details.RenderingMode;
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
public sealed record VideoSeason(Entity Entity, VideoSeasonDetails Details);

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
