using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for an image gallery.
/// </summary>
/// <param name="Id">Gallery entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Gallery title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the gallery.</param>
/// <param name="Children">Projected image children in gallery order.</param>
/// <param name="GalleryType">Gallery storage shape.</param>
/// <param name="CoverImageId">Selected cover image entity, when one is set.</param>
public sealed record GalleryDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityCard> Children,
    string GalleryType,
    Guid? CoverImageId);
