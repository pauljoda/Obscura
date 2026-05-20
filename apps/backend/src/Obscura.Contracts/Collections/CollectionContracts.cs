using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Collections;

/// <summary>
/// API-facing collection detail shape with expanded collection members.
/// </summary>
/// <param name="Id">Collection entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Collection title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier; collections usually leave this null.</param>
/// <param name="SortOrder">Optional structural order under the parent entity.</param>
/// <param name="Capabilities">Shared entity capabilities for the collection.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="Relationships">Generic non-structural relationship groups keyed by entity kind.</param>
/// <param name="Mode">Collection membership mode.</param>
/// <param name="RuleTreeJson">Dynamic collection rule tree JSON, when present.</param>
/// <param name="CoverMode">Collection cover selection mode.</param>
/// <param name="CoverItemId">Entity selected as the collection cover item.</param>
/// <param name="SlideshowDuration">Duration for collection slideshow advancement.</param>
/// <param name="SlideshowAutoAdvance">Whether collection slideshows advance automatically.</param>
/// <param name="LastRefreshedAt">Last dynamic refresh timestamp, when known.</param>
public sealed record CollectionDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
    string? Mode = null,
    string? RuleTreeJson = null,
    string? CoverMode = null,
    Guid? CoverItemId = null,
    TimeSpan? SlideshowDuration = null,
    bool? SlideshowAutoAdvance = null,
    DateTimeOffset? LastRefreshedAt = null) : IEntityCard;
