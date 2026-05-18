namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of database backup lifecycle statuses.
/// </summary>
public enum DatabaseBackupStatus {
    /// <summary>Backup process is currently running.</summary>
    Running,

    /// <summary>Backup finished and the output file is ready.</summary>
    Completed,

    /// <summary>Backup process failed and the error field should explain why.</summary>
    Failed
}

/// <summary>
/// Codec for database backup lifecycle status codes.
/// </summary>
public sealed class DatabaseBackupStatusCodec : EnumCodec<DatabaseBackupStatus> {
    public DatabaseBackupStatusCodec()
        : base(new Dictionary<DatabaseBackupStatus, string> {
            [DatabaseBackupStatus.Running] = "running",
            [DatabaseBackupStatus.Completed] = "completed",
            [DatabaseBackupStatus.Failed] = "failed"
        }) {
    }
}
