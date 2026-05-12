namespace Obscura.Domain.Entities;

/// <summary>Playable video media entity kind.</summary>
public sealed record VideoEntityKind()
    : IEntityKind
{
    public string Code => "video";
    public string DisplayName => "Video";
    public EntityKindCategory Category => EntityKindCategory.Media;
    public IReadOnlyList<EntityFileRole> ImageAssetRoles =>
    [
        EntityFileRole.Thumbnail,
        EntityFileRole.Poster,
        EntityFileRole.Backdrop,
        EntityFileRole.Logo,
        EntityFileRole.Preview,
        EntityFileRole.Sprite,
        EntityFileRole.Trickplay
    ];
}
