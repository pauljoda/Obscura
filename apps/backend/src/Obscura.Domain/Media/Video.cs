using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a playable video media item.
/// </summary>
public sealed class Video : Entity {
    public Video(
        Guid id,
        string title,
        DateTimeOffset? subtitlesExtractedAt,
        IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? DefaultCapabilities()) {
        SubtitlesExtractedAt = subtitlesExtractedAt;
    }

    public override EntityKind Kind => EntityKind.Video;

    /// <summary>When embedded subtitles were last extracted, when known.</summary>
    public DateTimeOffset? SubtitlesExtractedAt { get; private set; }

    private static IEnumerable<EntityCapability> DefaultCapabilities() =>
    [
        new CapabilityRating(),
        new CapabilityImages(),
        new CapabilityLinks(),
        new CapabilityFlags(),
        new CapabilityFiles(),
        new CapabilityPlayback(),
        new CapabilityCounters(),
        new CapabilityPosition(),
        new CapabilityMarkers(),
        new CapabilitySubtitles(),
        new CapabilityCredits()
    ];
}
