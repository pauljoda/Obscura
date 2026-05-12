namespace Obscura.Contracts.System;

public sealed record V2FreshStartPrepareResponse(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset);
