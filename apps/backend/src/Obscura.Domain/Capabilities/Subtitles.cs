namespace Obscura.Domain.Capabilities;

/// <summary>
/// Groups subtitle tracks for a media entity.
/// </summary>
/// <param name="Items">Ordered subtitle tracks available for playback.</param>
public sealed record Subtitles(IReadOnlyList<EntitySubtitle> Items)
{
    /// <summary>
    /// A reusable empty subtitle set for media without captions.
    /// </summary>
    public static Subtitles Empty { get; } = new([]);
}
