using Obscura.Infrastructure.Backups;

namespace Obscura.Infrastructure.Tests;

public sealed class PostgresBackupPlanTests
{
    [Fact]
    public void CreateBuildsTimestampedDumpPathUnderDataBackups()
    {
        var now = DateTimeOffset.Parse("2026-05-12T01:02:03Z");

        var plan = PostgresBackupPlan.Create("/data", now);

        Assert.Equal("/data/backups/obscura-pre-v2-20260512T010203Z.dump", plan.BackupPath);
        Assert.Equal("pg_dump", plan.FileName);
        Assert.Contains("--format=custom", plan.Arguments);
        Assert.Contains("--no-owner", plan.Arguments);
        Assert.Contains("--file", plan.Arguments);
        Assert.Contains(plan.BackupPath, plan.Arguments);
    }

    [Fact]
    public void CreateDockerFallbackStreamsDumpFromComposePostgresService()
    {
        var now = DateTimeOffset.Parse("2026-05-12T01:02:03Z");

        var plan = PostgresBackupPlan.CreateDockerFallback(
            "/data",
            now,
            "Host=localhost;Database=obscura;Username=obscura;Password=obscura",
            "/repo");

        Assert.Equal("/data/backups/obscura-pre-v2-20260512T010203Z.dump", plan.BackupPath);
        Assert.Equal("docker", plan.FileName);
        Assert.Equal(
            [
                "compose",
                "-f",
                "/repo/infra/docker/docker-compose.yml",
                "exec",
                "-T",
                "postgres",
                "pg_dump",
                "--format=custom",
                "--no-owner",
                "-U",
                "obscura",
                "-d",
                "obscura"
            ],
            plan.Arguments);
    }
}
