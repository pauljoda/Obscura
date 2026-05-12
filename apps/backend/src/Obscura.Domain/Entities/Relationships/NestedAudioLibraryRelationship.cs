namespace Obscura.Domain.Entities;

/// <summary>Relationship from an audio library to a nested audio library entity.</summary>
public sealed record NestedAudioLibraryRelationship()
    : EntityRelationship(EntityRelationshipCode.NestedAudioLibrary, "audio-library", "Nested Audio Library", true);
