namespace Obscura.Contracts.System;

/// <summary>
/// Summary returned after importing legacy video metadata into the v2 preview schema.
/// </summary>
/// <param name="SeriesImported">Number of video series entities imported.</param>
/// <param name="VideosImported">Number of video entities imported.</param>
/// <param name="PerformersImported">Number of performer entities imported.</param>
/// <param name="TagsImported">Number of tag entities imported.</param>
/// <param name="StudiosImported">Number of studio entities imported.</param>
/// <param name="LinksImported">Number of relationship or capability links imported.</param>
public sealed record LegacyVideoImportResponse(
    int SeriesImported,
    int VideosImported,
    int PerformersImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);
