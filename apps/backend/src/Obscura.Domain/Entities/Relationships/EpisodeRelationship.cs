namespace Obscura.Domain.Entities;

/// <summary>Relationship from a video series or season to an episode video.</summary>
public sealed record EpisodeRelationship()
    : IEntityRelationship
{
    public string Code => "episode";
    public string DisplayName => "Episode";
    public bool IsStructural => true;
}
