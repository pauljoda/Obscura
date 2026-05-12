using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Videos;

public sealed record VideoListResponse(
    IReadOnlyList<EntityCard> Items,
    string? NextCursor);

public sealed record VideoMarker(
    Guid Id,
    string Title,
    double Seconds,
    double? EndSeconds);

public sealed record VideoSubtitle(
    Guid Id,
    string Language,
    string? Label,
    string Format,
    string Source,
    string StoragePath,
    string SourceFormat,
    string? SourcePath,
    bool IsDefault);

public sealed record VideoDetail(
    Guid Id,
    string Kind,
    string Title,
    string? Summary,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    IReadOnlyList<VideoMarker> Markers,
    IReadOnlyList<VideoSubtitle> Subtitles,
    EntityCapabilities Capabilities);
