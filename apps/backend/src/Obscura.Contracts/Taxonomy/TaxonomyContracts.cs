using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

public sealed record TaxonomyListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

public sealed record TaxonomyDetail(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilities Capabilities);
