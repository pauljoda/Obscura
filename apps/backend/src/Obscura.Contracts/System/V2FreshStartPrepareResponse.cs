namespace Obscura.Contracts.System;

/// <summary>
/// Response returned after preparing a v2 fresh-start migration.
/// </summary>
/// <param name="BackupPath">Path to the database backup created before the reset.</param>
/// <param name="PreservedLibraryRoots">Number of library roots preserved for rescanning.</param>
/// <param name="PreservedSettings">Whether settings were preserved.</param>
/// <param name="MediaReset">Whether v2 media tables were reset.</param>
/// <param name="VideoImport">Counts from the legacy video import, or null if the import was skipped.</param>
/// <param name="MediaImport">Counts from the legacy non-video media import, or null if the import was skipped.</param>
public sealed record V2FreshStartPrepareResponse(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset,
    LegacyVideoImportResponse? VideoImport = null,
    LegacyMediaImportResponse? MediaImport = null);
