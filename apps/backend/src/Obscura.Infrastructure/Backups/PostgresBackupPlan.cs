using System.Globalization;
using Npgsql;

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

    public static PostgresBackupPlan CreateDockerFallback(
        string dataDir,
        DateTimeOffset now,
        string connectionString,
        string repoRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(repoRoot);

        var basePlan = Create(dataDir, now);
        return CreateDockerFallback(basePlan.BackupPath, connectionString, repoRoot);
    }

    public static PostgresBackupPlan CreateDockerFallback(
        string backupPath,
        string connectionString,
        string repoRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(backupPath);
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var user = string.IsNullOrWhiteSpace(builder.Username) ? "obscura" : builder.Username;
        var database = string.IsNullOrWhiteSpace(builder.Database) ? "obscura" : builder.Database;
        var composeFile = Path.Combine(repoRoot, "infra", "docker", "docker-compose.yml");

        return new PostgresBackupPlan(
            "docker",
            [
                "compose",
                "-f",
                composeFile,
                "exec",
                "-T",
                "postgres",
                "pg_dump",
                "--format=custom",
                "--no-owner",
                "-U",
                user,
                "-d",
                database
            ],
            backupPath);
    }
}
