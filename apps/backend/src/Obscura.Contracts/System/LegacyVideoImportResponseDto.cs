namespace Obscura.Contracts.System;

public sealed record LegacyVideoImportResponseDto(
    int SeriesImported,
    int VideosImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
