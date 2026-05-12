namespace Obscura.Domain.Entities;

/// <summary>Relationship from a book or volume to a readable chapter.</summary>
public sealed record ChapterRelationship()
    : IEntityRelationship
{
    public string Code => "chapter";
    public string DisplayName => "Chapter";
    public bool IsStructural => true;
}
