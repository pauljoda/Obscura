namespace Obscura.Domain.Entities;

/// <summary>Relationship from a studio to a nested studio.</summary>
public sealed record NestedStudioRelationship()
    : EntityRelationship(EntityRelationshipCode.NestedStudio, "studio", "Nested Studio", true);
