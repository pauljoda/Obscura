namespace Obscura.Contracts.Entities;

public sealed record EntityReference(Guid Id, string Kind, string Title);

public sealed record Rating(int? Value);

public sealed record EntityUrl(string Url, string? Label);

public sealed record EntityExternalId(string Provider, string Value, string? Url);

public sealed record EntityCapabilities(
    Rating? Rating,
    IReadOnlyList<string> Tags,
    IReadOnlyList<EntityReference> Credits,
    EntityReference? Studio,
    IReadOnlyList<EntityUrl> Urls,
    IReadOnlyList<EntityExternalId> ExternalIds,
    string? ThumbnailUrl,
    string? CoverUrl,
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);

public sealed record EntityCard(
    Guid Id,
    string Kind,
    string Title,
    string? Subtitle,
    EntityCapabilities Capabilities);

public sealed record EntityListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

public sealed record RatingUpdateRequest(int? Value);

public sealed record EntityFlagsUpdateRequest(
    bool? IsFavorite,
    bool? IsNsfw,
    bool? IsOrganized);
