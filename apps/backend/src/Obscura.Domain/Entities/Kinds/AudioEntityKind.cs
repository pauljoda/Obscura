namespace Obscura.Domain.Entities;

/// <summary>Generic audio entity kind.</summary>
public sealed record AudioEntityKind()
    : EntityKind(EntityKindCode.Audio, "audio", "Audio", EntityKindCategory.Media);
