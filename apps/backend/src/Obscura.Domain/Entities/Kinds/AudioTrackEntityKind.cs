namespace Obscura.Domain.Entities;

/// <summary>Single audio track entity kind.</summary>
public sealed record AudioTrackEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.AudioTrack;
    public string Code => "audio-track";
    public string DisplayName => "Audio Track";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
