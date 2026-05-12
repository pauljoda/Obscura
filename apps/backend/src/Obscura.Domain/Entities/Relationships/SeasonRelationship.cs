namespace Obscura.Domain.Entities;

/// <summary>Relationship from a video series to a season grouping.</summary>
public sealed record SeasonRelationship()
    : IEntityRelationship
{
    public EntityRelationshipCode Value => EntityRelationshipCode.Season;
    public string Code => "season";
    public string DisplayName => "Season";
    public bool IsStructural => true;
}
