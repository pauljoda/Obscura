namespace Obscura.Domain.Entities;

/// <summary>Video series entity kind.</summary>
public sealed record VideoSeriesEntityKind()
    : EntityKind(EntityKindCode.VideoSeries, "video-series", "Video Series", EntityKindCategory.Media);
