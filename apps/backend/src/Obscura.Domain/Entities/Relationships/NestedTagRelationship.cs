namespace Obscura.Domain.Entities;

/// <summary>Relationship from a tag to a nested tag.</summary>
public sealed record NestedTagRelationship()
    : EntityRelationship(EntityRelationshipCode.NestedTag, "tag", "Nested Tag", true);
