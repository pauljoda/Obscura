using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Videos;

/// <summary>
/// API-facing video detail shape combining video metadata with shared entity capabilities.
/// </summary>
/// <param name="Id">Video entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Video title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when the video is an episode or other child.</param>
/// <param name="SortOrder">Optional structural order under the parent entity.</param>
/// <param name="Capabilities">Shared entity capabilities for the video.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Relationships">Generic non-structural relationship groups keyed by entity kind.</param>
/// <param name="CreditMetadata">Relationship edge metadata for credited people shown on detail pages.</param>
/// <param name="SubtitlesExtractedAt">When embedded subtitles were last extracted, when known.</param>
public sealed record VideoDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
    IReadOnlyList<EntityCreditMetadata> CreditMetadata,
    DateTimeOffset? SubtitlesExtractedAt) : IEntityCard;
