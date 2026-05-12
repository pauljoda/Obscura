using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

public sealed record MediaListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record MediaDetailDto(
    Guid Id,
    string Kind,
    string Title,
    EntityCapabilitiesDto Capabilities);
