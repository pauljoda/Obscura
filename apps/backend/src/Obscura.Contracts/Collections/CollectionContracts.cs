using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Collections;

/// <summary>
/// Cursor-paged response for collection browsing.
/// </summary>
/// <param name="Items">Current page of collection cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record CollectionListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

/// <summary>
/// API-facing collection detail shape with expanded collection members.
/// </summary>
/// <param name="Id">Collection entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Collection title.</param>
/// <param name="Capabilities">Shared entity capabilities for the collection.</param>
/// <param name="Items">Entity cards linked into the collection.</param>
public sealed record CollectionDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities,
    IReadOnlyList<EntityCard> Items);
