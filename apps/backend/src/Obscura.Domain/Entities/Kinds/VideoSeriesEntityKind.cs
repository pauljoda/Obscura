namespace Obscura.Domain.Entities;

/// <summary>Video series entity kind.</summary>
public sealed record VideoSeriesEntityKind()
    : IEntityKind
{
    public string Code => "video-series";
    public string DisplayName => "Video Series";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Poster,
        EntityFileRole.Backdrop,
        EntityFileRole.Logo
    ];
}
