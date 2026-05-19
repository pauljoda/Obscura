using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Series;

/// <summary>
/// Cursor-paged response for video-series browsing.
/// </summary>
/// <param name="Items">Current page of series cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record VideoSeriesListResponse(
    IReadOnlyList<EntityThumbnail> Items,
    string? NextCursor);

/// <summary>
/// API-facing video-series detail shape with projected child videos.
/// </summary>
/// <param name="Id">Series entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Series title.</param>
/// <param name="Capabilities">Shared entity capabilities for the series.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, or null for root series.</param>
/// <param name="SortOrder">Optional structural order under the parent entity.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Relationships">Generic non-structural relationship groups keyed by entity kind.</param>
/// <param name="CreditMetadata">Relationship edge metadata for credited people shown on detail pages.</param>
public sealed record VideoSeriesDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
    IReadOnlyList<EntityCreditMetadata> CreditMetadata) : IEntityCard;

/// <summary>
/// API-facing video-season detail shape with ordered episode videos.
/// </summary>
/// <param name="Id">Season entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Season title.</param>
/// <param name="ParentEntityId">Parent series entity identifier.</param>
/// <param name="SortOrder">Optional structural order under the parent entity.</param>
/// <param name="Capabilities">Shared entity capabilities for the season.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Relationships">Generic non-structural relationship groups keyed by entity kind.</param>
public sealed record VideoSeasonDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships) : IEntityCard;
