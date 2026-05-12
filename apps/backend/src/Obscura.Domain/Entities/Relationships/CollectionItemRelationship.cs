namespace Obscura.Domain.Entities;

/// <summary>Relationship from a user collection to one of its member entities.</summary>
public sealed record CollectionItemRelationship()
    : EntityRelationship(EntityRelationshipCode.CollectionItem, "collection-item", "Collection Item", false);
