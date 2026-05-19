namespace Obscura.Application.System;

/// <summary>
/// Application result describing whether the v2 upgrade gate has been accepted.
/// </summary>
public sealed record V2UpgradeGateStatusResult(string GateId, bool Accepted);

/// <summary>
/// Application result for legacy video import counts.
/// </summary>
public sealed record LegacyVideoImportResultDto(
    int SeriesImported,
    int VideosImported,
    int PeopleImported,
    int TagsImported,
    int StudiosImported,
    int LinksImported);

/// <summary>
/// Application result for legacy non-video media import counts.
/// </summary>
public sealed record LegacyMediaImportResultDto(
    int ImagesImported,
    int GalleriesImported,
    int BooksImported,
    int AudioLibrariesImported,
    int AudioTracksImported,
    int CollectionsImported,
    int LinksImported);

/// <summary>
/// Application result for preparing the v2 fresh-start migration.
/// </summary>
public sealed record V2FreshStartPrepareResult(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset,
    LegacyVideoImportResultDto? VideoImport,
    LegacyMediaImportResultDto? MediaImport);

/// <summary>
/// Application problem result that the API maps to its public problem contract.
/// </summary>
public sealed record ApplicationProblem(string Code, string Message);
