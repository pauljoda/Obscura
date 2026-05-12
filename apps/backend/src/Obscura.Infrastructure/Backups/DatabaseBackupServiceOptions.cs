namespace Obscura.Infrastructure.Backups;

public sealed record DatabaseBackupServiceOptions(
    string ConnectionString,
    string DataDir);
