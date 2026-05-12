using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Collections;

public sealed record CollectionListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record CollectionDetailDto(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilitiesDto Capabilities,
    IReadOnlyList<EntityCardDto> Items);
