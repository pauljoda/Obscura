namespace Obscura.Domain.Entities;

/// <summary>Relationship from an audio library to one of its track entities.</summary>
public sealed record AudioTrackRelationship()
    : EntityRelationship(EntityRelationshipCode.AudioTrack, "audio-track", "Audio Track", true);
