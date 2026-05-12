namespace Obscura.Domain.Entities;

/// <summary>Playable video media entity kind.</summary>
public sealed record VideoEntityKind()
    : EntityKind(EntityKindCode.Video, "video", "Video", EntityKindCategory.Media);
