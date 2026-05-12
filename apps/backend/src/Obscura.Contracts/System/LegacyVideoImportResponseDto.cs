namespace Obscura.Contracts.System;

public sealed record LegacyVideoImportResponseDto(
    int SeriesImported,
    int VideosImported,
    int PerformersImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
