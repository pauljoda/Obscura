using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Video entity extension with shared entity fields plus video-specific playback metadata.
/// </summary>
/// <param name="Id">Shared global entity identifier.</param>
/// <param name="Title">Display title inherited from the shared entity root.</param>
/// <param name="Subtitle">Optional display subtitle inherited from the shared entity root.</param>
/// <param name="Summary">Video synopsis or freeform details.</param>
/// <param name="SortTitle">Optional normalized title used for sorting.</param>
/// <param name="OriginalTitle">Optional provider or release-title value.</param>
/// <param name="Tagline">Optional short marketing or provider tagline.</param>
/// <param name="ReleaseDate">Release date as provider/user-facing text.</param>
/// <param name="ContentRating">Optional provider/user-facing content rating.</param>
/// <param name="Duration">Known runtime of the video.</param>
/// <param name="Width">Known video width in pixels.</param>
/// <param name="Height">Known video height in pixels.</param>
/// <param name="FrameRate">Known source frame rate.</param>
/// <param name="BitRate">Known source bit rate.</param>
/// <param name="Codec">Known source video codec.</param>
/// <param name="Container">Known source media container.</param>
/// <param name="LibraryRootId">Library root that introduced the video, when known.</param>
/// <param name="SubtitlesExtractedAt">When embedded subtitles were last extracted, when known.</param>
/// <param name="Markers">Timeline markers attached to the video.</param>
/// <param name="Subtitles">Subtitle tracks available for playback.</param>
public sealed record Video(
    Guid Id,
    string Title,
    string? Subtitle,
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
    Guid? LibraryRootId,
    DateTimeOffset? SubtitlesExtractedAt,
    Markers Markers,
    Subtitles Subtitles)
    : Entity(
        Id,
        EntityKindRegistry.Video,
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
            CapabilityFiles.Empty,
            CapabilityPlayback.Empty
        ])
{
    /// <summary>
    /// Creates a video from an already hydrated entity root while keeping video fields direct.
    /// </summary>
    public Video(
        Entity entity,
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
        Guid? LibraryRootId,
        DateTimeOffset? SubtitlesExtractedAt,
        Markers markers,
        Subtitles subtitles)
        : this(
            entity.Id,
            entity.Title,
            entity.Subtitle,
            Summary,
            SortTitle,
            OriginalTitle,
            Tagline,
            ReleaseDate,
            ContentRating,
            Duration,
            Width,
            Height,
            FrameRate,
            BitRate,
            Codec,
            Container,
            LibraryRootId,
            SubtitlesExtractedAt,
            markers,
            subtitles)
    {
        Capabilities = entity.Capabilities;
    }
}
