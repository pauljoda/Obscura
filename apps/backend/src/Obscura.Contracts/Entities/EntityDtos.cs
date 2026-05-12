namespace Obscura.Contracts.Entities;

public sealed record EntityReferenceDto(Guid Id, string Kind, string Title);

public sealed record RatingDto(int? Value);

public sealed record EntityUrlDto(string Url, string? Label);

public sealed record EntityExternalIdDto(string Provider, string Value, string? Url);

public sealed record EntityCapabilitiesDto(
    RatingDto? Rating,
    IReadOnlyList<string> Tags,
    IReadOnlyList<EntityReferenceDto> Credits,
    EntityReferenceDto? Studio,
    IReadOnlyList<EntityUrlDto> Urls,
    IReadOnlyList<EntityExternalIdDto> ExternalIds,
    string? ThumbnailUrl,
    string? CoverUrl,
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);

public sealed record EntityCardDto(
    Guid Id,
    string Kind,
    string Title,
    string? Subtitle,
    EntityCapabilitiesDto Capabilities);

public sealed record EntityListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record RatingUpdateRequestDto(int? Value);

public sealed record EntityFlagsUpdateRequestDto(
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);
