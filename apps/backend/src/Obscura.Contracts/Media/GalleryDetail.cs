using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for an image gallery.
/// </summary>
/// <param name="Id">Gallery entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Gallery title.</param>
/// <param name="ParentEntityId">Structural parent entity identifier, when this gallery is nested.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the gallery.</param>
/// <param name="ChildrenByKind">Generic child groups keyed by entity kind.</param>
/// <param name="GalleryType">Gallery storage shape.</param>
/// <param name="CoverImageId">Selected cover image entity, when one is set.</param>
public sealed record GalleryDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityChildGroup> ChildrenByKind,
    string GalleryType,
    Guid? CoverImageId);
