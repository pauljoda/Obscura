namespace Obscura.Infrastructure.Legacy;

public sealed record LegacyVideoImportResult(
    int SeriesImported,
    int VideosImported,
    int PerformersImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
