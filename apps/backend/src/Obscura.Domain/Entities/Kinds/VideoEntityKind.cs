namespace Obscura.Domain.Entities;

/// <summary>Playable video media entity kind.</summary>
public sealed record VideoEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.Video;
    public string Code => "video";
    public string DisplayName => "Video";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
