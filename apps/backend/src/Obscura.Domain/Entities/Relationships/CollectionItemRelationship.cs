namespace Obscura.Domain.Entities;

/// <summary>Relationship from a user collection to one of its member entities.</summary>
public sealed record CollectionItemRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.CollectionItem;
    public string Code => "collection-item";
    public string DisplayName => "Collection Item";
    public bool IsStructural => false;
}
