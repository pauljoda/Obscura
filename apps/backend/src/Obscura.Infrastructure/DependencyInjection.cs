using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Obscura.Infrastructure.Backups;
using Obscura.Infrastructure.Database;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.FreshStart;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Queue;
using Obscura.Infrastructure.Settings;
using Obscura.Infrastructure.Upgrades;

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
        var dataDir = configuration["OBSCURA_DATA_DIR"] ??
            configuration["Obscura:DataDir"] ??
            "/data";

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddDbContext<ObscuraDbContext>((provider, options) =>
            options.UseNpgsql(provider.GetRequiredService<NpgsqlDataSource>()));
        services.AddSingleton(new V2UpgradeGateOptions(dataDir));
        services.AddSingleton<IV2UpgradeGate, V2UpgradeGate>();
        services.AddSingleton(new DatabaseBackupServiceOptions(connectionString, dataDir));
        services.AddSingleton<IProcessRunner, ProcessRunner>();
        services.AddScoped<IDatabaseBackupService, DatabaseBackupService>();
        services.AddScoped<IV2FreshStartService, V2FreshStartService>();
        services.AddScoped<IEntityProjectionService, EntityProjectionService>();
        services.AddScoped<IJobQueueService, JobQueueService>();
        services.AddScoped<ISettingsService, SettingsService>();

        return services;
    }
}
