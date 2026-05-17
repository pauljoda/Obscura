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
        string? Status,
        VideoSeriesRenderingMode RenderingMode,
        IReadOnlyList<Entity> Children,
        IReadOnlyList<Entity> Videos,
        IReadOnlyList<ICapability>? capabilities = null,
        EntityChildren? childrenByKind = null)
        : base(
            Id,
            EntityKindRegistry.VideoSeries,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ],
            children: childrenByKind ?? BuildChildrenByKind(Children, Videos))
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
        : this(
            entity.Id,
            entity.Title,
            Status,
            RenderingMode,
            children,
            videos,
            entity.Capabilities,
            entity.ChildrenByKind.Sets.Count > 0 ? entity.ChildrenByKind : null)
    {
        Relationships = entity.Relationships;
    }

    private static EntityChildren BuildChildrenByKind(IReadOnlyList<Entity> children, IReadOnlyList<Entity> videos)
    {
        var sets = children
            .Concat(videos)
            .GroupBy(child => child.Kind.Code, StringComparer.OrdinalIgnoreCase)
            .Select(group => new EntityChildSet(group.First().Kind, group.ToArray()))
            .ToArray();

        return sets.Length == 0 ? EntityChildren.Empty : new EntityChildren(sets);
    }
}

/// <summary>
/// Structural video-season aggregate for season-grouped video series.
/// </summary>
public sealed record VideoSeason : Entity
{
    /// <summary>
    /// Creates a structural season entity with its parent series and ordered episode links.
    /// </summary>
    /// <param name="Id">Season entity identifier.</param>
    /// <param name="Title">Season display title.</param>
    /// <param name="ParentEntityId">Parent video-series entity identifier.</param>
    /// <param name="capabilities">Shared entity capabilities projected for the season.</param>
    /// <param name="videos">Episode videos linked to this season in hierarchy order.</param>
    public VideoSeason(
        Guid Id,
        string Title,
        Guid? ParentEntityId,
        IReadOnlyList<ICapability>? capabilities = null,
        IReadOnlyList<Entity>? videos = null,
        EntityChildren? childrenByKind = null,
        int? sortOrder = null,
        EntityRelationships? relationships = null)
        : base(
            Id,
            EntityKindRegistry.VideoSeason,
            Title,
            capabilities ?? [CapabilityImages.Empty, CapabilityDescription.Empty, CapabilityDates.Empty, CapabilitySource.Empty, CapabilityPosition.Empty],
            parentEntityId: ParentEntityId,
            sortOrder: sortOrder,
            children: childrenByKind ?? BuildChildrenByKind(videos ?? []),
            relationships: relationships)
    {
        Videos = videos ?? [];
    }

    /// <summary>Episode video cards linked to this season in hierarchy order.</summary>
    public IReadOnlyList<Entity> Videos { get; init; }

    /// <summary>
    /// Creates a season from an already hydrated entity root.
    /// </summary>
    /// <param name="entity">Hydrated season entity root.</param>
    /// <param name="ParentEntityId">Parent video-series entity identifier.</param>
    /// <param name="videos">Episode videos linked to this season in hierarchy order.</param>
    public VideoSeason(Entity entity, Guid? ParentEntityId, IReadOnlyList<Entity>? videos = null)
        : this(
            entity.Id,
            entity.Title,
            ParentEntityId,
            entity.Capabilities,
            videos,
            entity.ChildrenByKind.Sets.Count > 0 ? entity.ChildrenByKind : null,
            entity.SortOrder,
            entity.Relationships)
    {
    }

    private static EntityChildren BuildChildrenByKind(IReadOnlyList<Entity> videos) =>
        videos.Count == 0
            ? EntityChildren.Empty
            : new EntityChildren([new EntityChildSet(EntityKindRegistry.Video, videos)]);
}
