namespace Obscura.Infrastructure.Legacy;

public sealed record LegacyVideoImportResult(
    int SeriesImported,
    int VideosImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
