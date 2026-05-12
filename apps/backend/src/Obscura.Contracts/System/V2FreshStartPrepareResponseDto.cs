namespace Obscura.Contracts.System;

public sealed record V2FreshStartPrepareResponseDto(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset);
