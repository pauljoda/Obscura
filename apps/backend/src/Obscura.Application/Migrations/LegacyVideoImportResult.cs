namespace Obscura.Application.Migrations;

/// <summary>
/// Import counts returned after moving legacy video data into v2 entity tables.
/// </summary>
/// <param name="SeriesImported">Number of video-series entities imported.</param>
/// <param name="VideosImported">Number of video entities imported.</param>
/// <param name="PeopleImported">Number of people entities imported for credits.</param>
/// <param name="TagsImported">Number of tag entities imported.</param>
/// <param name="StudiosImported">Number of studio entities imported.</param>
/// <param name="LinksImported">Number of external/provider links imported.</param>
public sealed record LegacyVideoImportResult(
    int SeriesImported,
    int VideosImported,
    int PeopleImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
