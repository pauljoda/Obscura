using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// Cursor-paged response for non-video media browsing routes.
/// </summary>
/// <param name="Items">Current page of media cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record MediaListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

/// <summary>
/// API-facing detail shape for generic media entities such as images, galleries, books, and audio.
/// </summary>
/// <param name="Id">Media entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Media title.</param>
/// <param name="Capabilities">Shared entity capabilities for the media item.</param>
/// <param name="Children">Projected child cards, such as gallery images or album tracks.</param>
public sealed record MediaDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityCard> Children);
