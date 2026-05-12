namespace Obscura.Domain.Entities;

/// <summary>Relationship from a video series to a season grouping.</summary>
public sealed record SeasonRelationship()
    : IEntityRelationship
{
    public string Code => "season";
    public string DisplayName => "Season";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.VideoSeries, EntityKindRegistry.VideoSeries, EntityKindRegistry.VideoSeason, this, false, HierarchyOrdering.SortOrder)
    ];
}
