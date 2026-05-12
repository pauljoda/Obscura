namespace Obscura.Domain.Entities;

/// <summary>Relationship from an audio library to another library or track child.</summary>
public sealed record AudioLibraryRelationship()
    : IEntityRelationship
{
    public string Code => "audio-library";
    public string DisplayName => "Audio Library";
    public bool IsStructural => true;
    public IReadOnlyList<HierarchyLayer> Layers =>
    [
        new(EntityKindRegistry.AudioLibrary, EntityKindRegistry.AudioLibrary, EntityKindRegistry.AudioLibrary, this, false, HierarchyOrdering.SortOrder),
        new(EntityKindRegistry.AudioLibrary, EntityKindRegistry.AudioLibrary, EntityKindRegistry.AudioTrack, this, false, HierarchyOrdering.SortOrder)
    ];
}
