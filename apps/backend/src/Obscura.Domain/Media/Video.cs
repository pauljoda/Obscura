using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Media aggregate for video-specific detail layered on top of the shared entity root.
/// </summary>
/// <param name="Entity">Shared global entity root for the video.</param>
/// <param name="Summary">Optional synopsis or description.</param>
/// <param name="Duration">Runtime when known.</param>
/// <param name="Width">Source video width in pixels when known.</param>
/// <param name="Height">Source video height in pixels when known.</param>
/// <param name="Markers">Timeline markers attached to the video.</param>
/// <param name="Subtitles">Subtitle tracks available for playback.</param>
public sealed record Video(
    Entity Entity,
    string? Summary,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    Markers Markers,
    Subtitles Subtitles);
