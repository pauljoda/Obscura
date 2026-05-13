using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Video-series entity extension with projected child groupings and playable videos.
/// </summary>
public sealed record VideoSeries : Entity
{
    public VideoSeries(
        Guid Id,
        string Title,
        string? Subtitle,
        string? Status,
        VideoSeriesRenderingMode RenderingMode,
        IReadOnlyList<Entity> Children,
        IReadOnlyList<Entity> Videos,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.VideoSeries,
            Title,
            Subtitle,
            capabilities ??
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
        this.Status = Status;
        this.RenderingMode = RenderingMode;
        this.Children = Children;
        this.Videos = Videos;
    }

    public string? Status { get; init; }
    public VideoSeriesRenderingMode RenderingMode { get; init; }
    public IReadOnlyList<Entity> Children { get; init; }
    public IReadOnlyList<Entity> Videos { get; init; }

    public VideoSeries(
        Entity entity,
        string? Status,
        VideoSeriesRenderingMode RenderingMode,
        IReadOnlyList<Entity> children,
        IReadOnlyList<Entity> videos)
        : this(entity.Id, entity.Title, entity.Subtitle, Status, RenderingMode, children, videos, entity.Capabilities)
    {
    }
}

/// <summary>
/// Structural video-season aggregate for season-grouped video series.
/// </summary>
public sealed record VideoSeason : Entity
{
    public VideoSeason(
        Guid Id,
        string Title,
        string? Subtitle,
        Guid SeriesId,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.VideoSeason,
            Title,
            Subtitle,
            capabilities ?? [CapabilityImages.Empty, CapabilityDescription.Empty, CapabilityDates.Empty, CapabilitySource.Empty, CapabilityPosition.Empty])
    {
        this.SeriesId = SeriesId;
    }

    public Guid SeriesId { get; init; }

    public VideoSeason(Entity entity, Guid SeriesId)
        : this(entity.Id, entity.Title, entity.Subtitle, SeriesId, entity.Capabilities)
    {
    }
}
