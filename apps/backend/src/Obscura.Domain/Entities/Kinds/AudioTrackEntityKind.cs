namespace Obscura.Domain.Entities;

/// <summary>Single audio track entity kind.</summary>
public sealed record AudioTrackEntityKind()
    : EntityKind(EntityKindCode.AudioTrack, "audio-track", "Audio Track", EntityKindCategory.Media);
