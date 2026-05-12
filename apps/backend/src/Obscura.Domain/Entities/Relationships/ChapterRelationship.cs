namespace Obscura.Domain.Entities;

/// <summary>Relationship from a book or volume to a readable chapter.</summary>
public sealed record ChapterRelationship()
    : EntityRelationship(EntityRelationshipCode.Chapter, "chapter", "Chapter", true);
