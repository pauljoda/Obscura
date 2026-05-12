namespace Obscura.Domain.Entities;

/// <summary>Relationship from a book to a volume grouping.</summary>
public sealed record VolumeRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.Volume;
    public string Code => "volume";
    public string DisplayName => "Volume";
    public bool IsStructural => true;
}
