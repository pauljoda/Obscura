namespace Obscura.Domain.Entities;

/// <summary>Relationship from a studio to a nested studio.</summary>
public sealed record NestedStudioRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.NestedStudio;
    public string Code => "studio";
    public string DisplayName => "Nested Studio";
    public bool IsStructural => true;
}
