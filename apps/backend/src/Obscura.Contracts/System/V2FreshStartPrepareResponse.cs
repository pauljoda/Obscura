namespace Obscura.Contracts.System;

/// <summary>
/// Response returned after preparing a v2 fresh-start migration.
/// </summary>
/// <param name="BackupPath">Path to the database backup created before the reset.</param>
/// <param name="PreservedLibraryRoots">Number of library roots preserved for rescanning.</param>
/// <param name="PreservedSettings">Whether settings were preserved.</param>
/// <param name="MediaReset">Whether v2 media tables were reset.</param>
public sealed record V2FreshStartPrepareResponse(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset);
