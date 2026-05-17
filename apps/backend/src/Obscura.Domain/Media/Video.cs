using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Video entity extension. Shared metadata is exposed through capabilities; only video-only state stays direct.
/// </summary>
public sealed record Video : Entity
{
    /// <summary>
    /// Creates a video entity extension with explicit shared capabilities.
    /// </summary>
    public Video(
        Guid Id,
        string Title,
        DateTimeOffset? SubtitlesExtractedAt,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Video,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty,
                CapabilityPlayback.Empty,
                CapabilityCounters.Empty,
                CapabilityMarkers.Empty,
                CapabilitySubtitles.Empty
            ])
    {
        this.SubtitlesExtractedAt = SubtitlesExtractedAt;
    }

    /// <summary>When embedded subtitles were last extracted, when known.</summary>
    public DateTimeOffset? SubtitlesExtractedAt { get; init; }

    /// <summary>
    /// Creates a video from an already hydrated entity root.
    /// </summary>
    public Video(Entity entity, DateTimeOffset? SubtitlesExtractedAt)
        : base(
            entity.Id,
            EntityKindRegistry.Video,
            entity.Title,
            entity.Capabilities,
            entity.ParentEntityId,
            entity.SortOrder,
            entity.ChildrenByKind,
            entity.Relationships)
    {
        this.SubtitlesExtractedAt = SubtitlesExtractedAt;
    }
}
