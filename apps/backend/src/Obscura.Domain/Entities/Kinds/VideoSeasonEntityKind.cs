namespace Obscura.Domain.Entities;

/// <summary>Video season structural entity kind.</summary>
public sealed record VideoSeasonEntityKind()
    : EntityKind(EntityKindCode.VideoSeason, "video-season", "Video Season", EntityKindCategory.Media);
