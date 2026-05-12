namespace Obscura.Infrastructure.Legacy;

public sealed record LegacyVideoImportResult(
    int SeriesImported,
    int VideosImported,
    int PeopleImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
