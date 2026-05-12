namespace Obscura.Domain.Entities;

/// <summary>Relationship from an audio library to a nested audio library entity.</summary>
public sealed record NestedAudioLibraryRelationship()
    : IEntityRelationship
{
    public string Code => "nested-audio-library";
    public string DisplayName => "Nested Audio Library";
    public bool IsStructural => true;
}
