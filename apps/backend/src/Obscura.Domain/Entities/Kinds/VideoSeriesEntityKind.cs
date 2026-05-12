namespace Obscura.Domain.Entities;

/// <summary>Video series entity kind.</summary>
public sealed record VideoSeriesEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.VideoSeries;
    public string Code => "video-series";
    public string DisplayName => "Video Series";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
