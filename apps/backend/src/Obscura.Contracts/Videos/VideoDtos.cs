using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Videos;

public sealed record VideoListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record VideoDetailDto(
    Guid Id,
    string Kind,
    string Title,
    string? Summary,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    EntityCapabilitiesDto Capabilities);
