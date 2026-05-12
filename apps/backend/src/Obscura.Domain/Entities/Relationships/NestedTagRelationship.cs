namespace Obscura.Domain.Entities;

/// <summary>Relationship from a tag to a nested tag.</summary>
public sealed record NestedTagRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.NestedTag;
    public string Code => "tag";
    public string DisplayName => "Nested Tag";
    public bool IsStructural => true;
}
