using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a video series grouping.
/// </summary>
public sealed class VideoSeries : Entity {
    public VideoSeries(
        Guid id,
        string title,
        string? status = null,
        VideoSeriesRenderingMode renderingMode = VideoSeriesRenderingMode.Seasons,
        IEnumerable<Entity>? children = null,
        IEnumerable<Entity>? videos = null,
        IEnumerable<EntityCapability>? capabilities = null)
        : base(id, title, capabilities ?? DefaultCapabilities()) {
        Status = status;
        RenderingMode = renderingMode;

        foreach (var child in children ?? []) {
            AddChild(child);
        }

        foreach (var video in videos ?? []) {
            AddChild(video);
        }
    }

    public override EntityKind Kind => EntityKind.VideoSeries;
    public string? Status { get; private set; }
    public VideoSeriesRenderingMode RenderingMode { get; private set; }
    public IReadOnlyList<Entity> Videos => ChildrenOf(EntityKind.Video);

    private static IEnumerable<EntityCapability> DefaultCapabilities() =>
    [
        new CapabilityRating(),
        new CapabilityImages(),
        new CapabilityLinks(),
        new CapabilityFlags(),
        new CapabilityFiles()
    ];
}

/// <summary>
/// Structural video-season aggregate.
/// </summary>
public sealed class VideoSeason : Entity {
    public VideoSeason(
        Guid id,
        string title,
        Guid? parentEntityId,
        IEnumerable<EntityCapability>? capabilities = null,
        IEnumerable<Entity>? videos = null,
        int? sortOrder = null)
        : base(
            id,
            title,
            capabilities ?? [new CapabilityImages(), new CapabilityDescription(), new CapabilityDates(), new CapabilitySource(), new CapabilityPosition()],
            parentEntityId: parentEntityId,
            sortOrder: sortOrder) {
        foreach (var video in videos ?? []) {
            AddChild(video);
        }
    }

    public override EntityKind Kind => EntityKind.VideoSeason;
    public IReadOnlyList<Entity> Videos => ChildrenOf(EntityKind.Video);
}
