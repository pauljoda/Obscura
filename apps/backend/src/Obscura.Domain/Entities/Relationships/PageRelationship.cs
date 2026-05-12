namespace Obscura.Domain.Entities;

/// <summary>Relationship from a chapter to a readable page.</summary>
public sealed record PageRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.Page;
    public string Code => "page";
    public string DisplayName => "Page";
    public bool IsStructural => true;
}
