using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Collections;

public sealed record CollectionListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

public sealed record CollectionDetail(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilities Capabilities,
    IReadOnlyList<EntityCard> Items);
