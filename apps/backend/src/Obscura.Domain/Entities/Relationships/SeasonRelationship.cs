namespace Obscura.Domain.Entities;

/// <summary>Relationship from a video series to a season grouping.</summary>
public sealed record SeasonRelationship()
    : EntityRelationship(EntityRelationshipCode.Season, "season", "Season", true);
