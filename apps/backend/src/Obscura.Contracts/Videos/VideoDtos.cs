using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Videos;

public sealed record VideoListResponseDto(
    IReadOnlyList<EntityCardDto> Items,
    string? NextCursor);

public sealed record VideoMarkerDto(
    Guid Id,
    string Title,
    double Seconds,
    double? EndSeconds);

public sealed record VideoSubtitleDto(
    Guid Id,
    string Language,
    string? Label,
    string Format,
    string Source,
    string StoragePath,
    string SourceFormat,
    string? SourcePath,
    bool IsDefault);

public sealed record VideoDetailDto(
    Guid Id,
    string Kind,
    string Title,
    string? Summary,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    IReadOnlyList<VideoMarkerDto> Markers,
    IReadOnlyList<VideoSubtitleDto> Subtitles,
    EntityCapabilitiesDto Capabilities);
