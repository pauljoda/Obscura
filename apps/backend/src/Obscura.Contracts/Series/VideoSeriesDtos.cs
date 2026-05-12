using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Series;

public sealed record VideoSeriesListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record VideoSeriesDetailDto(
    Guid Id,
    string Kind,
    string Title,
    string? Summary,
    EntityCapabilitiesDto Capabilities,
    IReadOnlyList<EntityCardDto> Children,
    IReadOnlyList<EntityCardDto> Videos,
    string RenderingMode);
