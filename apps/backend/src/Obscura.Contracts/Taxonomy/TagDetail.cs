using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// API-facing detail shape for a tag taxonomy entity.
/// </summary>
/// <param name="Id">Tag entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Tag title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when this tag is nested.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the tag.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="IgnoreAutoTag">Whether automatic tagging should ignore this tag.</param>
public sealed record TagDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships,
    bool IgnoreAutoTag) : IEntityCard;
