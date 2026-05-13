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
