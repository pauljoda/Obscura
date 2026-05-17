using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for a single image entity.
/// </summary>
/// <param name="Id">Image entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Image title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when this image belongs to a gallery.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the image.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
public sealed record ImageDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityChildGroup> ChildrenByKind,
    IReadOnlyList<EntityRelationshipGroup> Relationships);
