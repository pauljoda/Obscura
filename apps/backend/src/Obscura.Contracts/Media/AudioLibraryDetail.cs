using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for an album, audiobook, podcast, or other audio grouping.
/// </summary>
/// <param name="Id">Audio library entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Audio library title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when this audio library is nested.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the audio library.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
public sealed record AudioLibraryDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityGroup> ChildrenByKind,
    IReadOnlyList<EntityGroup> Relationships) : IEntityCard;
