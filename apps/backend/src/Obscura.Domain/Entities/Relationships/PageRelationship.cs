namespace Obscura.Domain.Entities;

/// <summary>Relationship from a chapter to a readable page.</summary>
public sealed record PageRelationship()
    : EntityRelationship(EntityRelationshipCode.Page, "page", "Page", true);
