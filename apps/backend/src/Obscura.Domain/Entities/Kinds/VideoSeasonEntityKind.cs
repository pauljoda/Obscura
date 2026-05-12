namespace Obscura.Domain.Entities;

/// <summary>Video season structural entity kind.</summary>
public sealed record VideoSeasonEntityKind()
    : IEntityKind
{
    public string Code => "video-season";
    public string DisplayName => "Video Season";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
