using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for video-specific detail layered on top of the shared entity root.
/// </summary>
/// <param name="Entity">Shared global entity root for the video.</param>
/// <param name="Details">Video-specific descriptive and technical metadata.</param>
/// <param name="Markers">Timeline markers attached to the video.</param>
/// <param name="Subtitles">Subtitle tracks available for playback.</param>
public sealed record Video(
    Entity Entity,
    VideoDetails Details,
    Markers Markers,
    Subtitles Subtitles)
{
    /// <summary>Optional synopsis or description.</summary>
    public string? Summary => Details.Summary;

    /// <summary>Runtime when known.</summary>
    public TimeSpan? Duration => Details.Duration;

    /// <summary>Source video width in pixels when known.</summary>
    public int? Width => Details.Width;

    /// <summary>Source video height in pixels when known.</summary>
    public int? Height => Details.Height;
}

/// <summary>
/// Video-specific metadata and technical probe fields.
/// </summary>
public sealed record VideoDetails(
    Guid? LibraryRootId,
    string? Summary,
    string? SortTitle,
    string? OriginalTitle,
    string? Tagline,
    string? ReleaseDate,
    string? ContentRating,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    double? FrameRate,
    int? BitRate,
    string? Codec,
    string? Container,
    DateTimeOffset? SubtitlesExtractedAt)
{
    /// <summary>
    /// Empty video details used before scan or probe data is attached.
    /// </summary>
    public static VideoDetails Empty { get; } = new(
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
        null,
        null,
        null,
        null);
}
