using Npgsql;

namespace Obscura.Infrastructure.Backups;

public static class PostgresEnvironment
{
    public static IReadOnlyDictionary<string, string> FromConnectionString(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var environment = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["PGHOST"] = builder.Host ?? "localhost",
            ["PGDATABASE"] = builder.Database ?? "obscura",
            ["PGUSER"] = builder.Username ?? "obscura"
        };

        if (builder.Port > 0)
        {
            environment["PGPORT"] = builder.Port.ToString();
        }

        if (!string.IsNullOrEmpty(builder.Password))
        {
            environment["PGPASSWORD"] = builder.Password;
        }

        return environment;
    }
}
