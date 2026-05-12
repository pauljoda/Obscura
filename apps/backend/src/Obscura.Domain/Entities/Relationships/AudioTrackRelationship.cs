namespace Obscura.Domain.Entities;

/// <summary>Relationship from an audio library to one of its track entities.</summary>
public sealed record AudioTrackRelationship()
    : IEntityRelationship
{
    public string Code => "audio-track";
    public string DisplayName => "Audio Track";
    public bool IsStructural => true;
}
