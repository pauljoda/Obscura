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
