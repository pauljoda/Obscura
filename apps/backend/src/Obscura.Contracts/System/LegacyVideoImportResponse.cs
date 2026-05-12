namespace Obscura.Contracts.System;

public sealed record LegacyVideoImportResponse(
    int SeriesImported,
    int VideosImported,
    int PerformersImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
