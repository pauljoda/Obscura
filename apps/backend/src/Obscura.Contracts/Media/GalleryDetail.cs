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
/// <param name="CreditMetadata">Relationship edge metadata for credited people shown on detail pages.</param>
/// <param name="GalleryType">Gallery storage shape.</param>
/// <param name="CoverImageId">Selected cover image entity, when one is set.</param>
public sealed record GalleryDetail(
    Guid Id,
    string Kind,
    string Title,
    Guid? ParentEntityId,
    int? SortOrder,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityChildGroup> ChildrenByKind,
    IReadOnlyList<EntityRelationshipGroup> Relationships,
    IReadOnlyList<EntityCreditMetadata> CreditMetadata,
    string GalleryType,
    Guid? CoverImageId);
