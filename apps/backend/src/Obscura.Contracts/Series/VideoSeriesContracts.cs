using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Series;

public sealed record VideoSeriesListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

public sealed record VideoSeriesDetail(
    Guid Id,
    string Kind,
    string Title,
    string? Summary,
    EntityCapabilities Capabilities,
    IReadOnlyList<EntityCard> Children,
    IReadOnlyList<EntityCard> Videos,
    string RenderingMode);
