namespace Obscura.Infrastructure.FreshStart;

public sealed record V2FreshStartResult(
    string BackupPath,
    int PreservedLibraryRoots,
    bool PreservedSettings,
    bool MediaReset);
