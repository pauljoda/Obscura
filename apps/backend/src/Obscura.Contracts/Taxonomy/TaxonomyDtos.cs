using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

public sealed record TaxonomyListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record TaxonomyDetailDto(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilitiesDto Capabilities);
