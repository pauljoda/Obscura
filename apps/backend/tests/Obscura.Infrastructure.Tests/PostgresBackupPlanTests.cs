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
}
