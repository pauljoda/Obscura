namespace Obscura.Domain.Entities;

/// <summary>Relationship from a video series or season to an episode video.</summary>
public sealed record EpisodeRelationship()
    : EntityRelationship(EntityRelationshipCode.Episode, "episode", "Episode", true);
