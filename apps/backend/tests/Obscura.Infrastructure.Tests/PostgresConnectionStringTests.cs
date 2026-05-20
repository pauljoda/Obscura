using Obscura.Infrastructure.Database;

namespace Obscura.Infrastructure.Tests;

public sealed class PostgresConnectionStringTests {
    [Fact]
    public void NormalizeKeepsNpgsqlConnectionStrings() {
        const string input = "Host=postgres;Port=5432;Database=obscura;Username=obscura;Password=obscura";

        var normalized = PostgresConnectionString.Normalize(input);

        Assert.Equal(input, normalized);
    }

    [Fact]
    public void NormalizeConvertsDockerDatabaseUrlsToNpgsqlConnectionStrings() {
        var normalized = PostgresConnectionString.Normalize(
            "postgresql://obscura:secret@postgres:5432/obscura");

        Assert.Equal(
            "Host=postgres;Port=5432;Database=obscura;Username=obscura;Password=secret",
            normalized);
    }
}
