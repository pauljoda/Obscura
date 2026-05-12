using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Obscura.Infrastructure.Database;

namespace Obscura.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddObscuraInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var configuredConnectionString =
            configuration["DATABASE_URL"] ??
            configuration.GetConnectionString("Obscura") ??
            throw new InvalidOperationException("Obscura requires DATABASE_URL or ConnectionStrings:Obscura.");

        var connectionString = PostgresConnectionString.Normalize(configuredConnectionString);

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));

        return services;
    }
}
