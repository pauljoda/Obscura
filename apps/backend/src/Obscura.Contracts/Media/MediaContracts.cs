using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

public sealed record MediaListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

public sealed record MediaDetail(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilities Capabilities,
    IReadOnlyList<EntityCard> Children);
