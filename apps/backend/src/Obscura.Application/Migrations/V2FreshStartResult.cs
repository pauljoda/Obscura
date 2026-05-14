namespace Obscura.Application.Migrations;

/// <summary>
/// Result produced by the v2 fresh-start preparation workflow.
/// </summary>
/// <param name="BackupPath">Path to the backup created before media data was reset.</param>
/// <param name="PreservedLibraryRoots">Number of library roots retained for rescanning.</param>
/// <param name="PreservedSettings">Whether user settings were retained.</param>
/// <param name="MediaReset">Whether v2 media data was reset.</param>
/// <param name="CachePurged">Whether stale v1 cache directories were deleted to free disk space.</param>
public sealed record V2FreshStartResult(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset,
    bool CachePurged);
