using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// Cursor-paged response for taxonomy browsing routes.
/// </summary>
/// <param name="Items">Current page of taxonomy cards.</param>
/// <param name="NextCursor">Cursor for the next page, or null when complete.</param>
public sealed record TaxonomyListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

/// <summary>
/// API-facing detail shape for taxonomy entities such as people, studios, and tags.
/// </summary>
/// <param name="Id">Taxonomy entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Taxonomy entity title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the taxonomy entity.</param>
public sealed record TaxonomyDetail(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilities Capabilities);
