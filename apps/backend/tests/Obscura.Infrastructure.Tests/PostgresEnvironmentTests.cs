using Obscura.Infrastructure.Backups;

namespace Obscura.Infrastructure.Tests;

public sealed class PostgresEnvironmentTests
{
    [Fact]
    public void FromConnectionStringMapsNpgsqlSettingsToPgDumpEnvironment()
    {
        var environment = PostgresEnvironment.FromConnectionString(
            "Host=postgres;Port=5433;Database=obscura;Username=obscura;Password=secret");

        Assert.Equal("postgres", environment["PGHOST"]);
        Assert.Equal("5433", environment["PGPORT"]);
        Assert.Equal("obscura", environment["PGDATABASE"]);
        Assert.Equal("obscura", environment["PGUSER"]);
        Assert.Equal("secret", environment["PGPASSWORD"]);
    }
}
