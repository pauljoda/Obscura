namespace Obscura.Domain.Entities;

/// <summary>Relationship from a book to a volume grouping.</summary>
public sealed record VolumeRelationship()
    : EntityRelationship(EntityRelationshipCode.Volume, "volume", "Volume", true);
