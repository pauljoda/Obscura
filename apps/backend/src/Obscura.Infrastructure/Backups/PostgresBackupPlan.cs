using System.Globalization;

namespace Obscura.Infrastructure.Backups;

public sealed record PostgresBackupPlan(
    string FileName,
    IReadOnlyList<string> Arguments,
    string BackupPath)
{
    public static PostgresBackupPlan Create(string dataDir, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(dataDir);

        var backupDir = Path.Combine(dataDir, "backups");
        var stamp = now.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
        var backupPath = Path.Combine(backupDir, $"obscura-pre-v2-{stamp}.dump");

        return new PostgresBackupPlan(
            "pg_dump",
            ["--format=custom", "--no-owner", "--file", backupPath],
            backupPath);
    }
}
