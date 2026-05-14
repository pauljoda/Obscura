using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Obscura.Application.Jobs;
using Obscura.Application.Jobs.Ports;
using Obscura.Application.Migrations;
using Obscura.Application.Settings;
using Obscura.Application.Videos;
using Obscura.Infrastructure.Backups;
using Obscura.Infrastructure.Collections;
using Obscura.Infrastructure.Database;
using Obscura.Domain.Interfaces;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.FreshStart;
using Obscura.Infrastructure.Legacy;
using Obscura.Infrastructure.Media.Adapters;
using Obscura.Infrastructure.Media.Persistence;
using Obscura.Infrastructure.Media.Processing;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Processes;
using Obscura.Infrastructure.Queue;
using Obscura.Infrastructure.Settings;
using Obscura.Infrastructure.Upgrades;
using Obscura.Infrastructure.Videos;

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
        var cacheDir = configuration["OBSCURA_CACHE_DIR"] ??
            configuration["Obscura:CacheDir"] ??
            Path.Combine(dataDir, "cache");

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddDbContext<ObscuraDbContext>((provider, options) =>
            options.UseNpgsql(provider.GetRequiredService<NpgsqlDataSource>()));
        services.AddSingleton(new V2UpgradeGateOptions(dataDir));
        services.AddSingleton<IV2UpgradeGate, V2UpgradeGate>();
        services.AddSingleton(new DatabaseBackupServiceOptions(connectionString, dataDir));
        services.AddSingleton<ProcessExecutor>();
        services.AddSingleton<MediaToolService>();
        services.AddSingleton<FileDiscoveryService>();
        services.AddSingleton(new AssetPathService(dataDir));
        services.AddSingleton(provider => new MediaProbeService(provider.GetRequiredService<ProcessExecutor>()));
        services.AddSingleton(provider => new ThumbnailService(provider.GetRequiredService<ProcessExecutor>()));
        services.AddSingleton<HashingService>();

        services.AddSingleton<IFileDiscovery>(provider =>
            new FileDiscoveryAdapter(provider.GetRequiredService<FileDiscoveryService>()));
        services.AddSingleton<IMediaProbe>(provider =>
            new MediaProbeAdapter(provider.GetRequiredService<MediaProbeService>()));
        services.AddSingleton<IMediaHashing>(provider =>
            new MediaHashingAdapter(provider.GetRequiredService<HashingService>()));
        services.AddSingleton<IMediaAssetGenerator>(provider =>
            new MediaAssetGeneratorAdapter(
                provider.GetRequiredService<ThumbnailService>(),
                provider.GetRequiredService<AssetPathService>()));
        services.AddScoped<ILibraryScanPersistence, LibraryScanPersistenceService>();
        services.AddScoped<IMaintenancePersistence>(provider =>
            new MaintenancePersistenceService(provider.GetRequiredService<ObscuraDbContext>(), dataDir));
        services.AddScoped<ICollectionRuleEngine, CollectionRuleEngine>();
        services.AddScoped<ICollectionRefreshPersistence, CollectionRefreshPersistenceService>();
        services.AddScoped<DatabaseBackupService>();
        services.AddScoped<IV2FreshStartService>(provider =>
            new V2FreshStartService(
                provider.GetRequiredService<ObscuraDbContext>(),
                provider.GetRequiredService<DatabaseBackupService>(),
                cacheDir,
                provider.GetRequiredService<ILogger<V2FreshStartService>>()));
        services.AddScoped<ILegacyMediaImportService, LegacyMediaImportService>();
        services.AddScoped<ILegacyVideoImportService, LegacyVideoImportService>();
        services.AddScoped<ILegacyAssetNormalizationService>(provider =>
            new LegacyAssetNormalizationService(
                provider.GetRequiredService<NpgsqlDataSource>(),
                provider.GetRequiredService<AssetPathService>().CacheRoot,
                provider.GetRequiredService<ILogger<LegacyAssetNormalizationService>>()));
        services.AddScoped<EntityProjectionService>();
        services.AddScoped<IEntityCatalog>(provider => provider.GetRequiredService<EntityProjectionService>());
        services.AddScoped<IEntityDetails>(provider => provider.GetRequiredService<EntityProjectionService>());
        services.AddScoped<IEntityHierarchy>(provider => provider.GetRequiredService<EntityProjectionService>());
        services.AddScoped<IRatingService>(provider => provider.GetRequiredService<EntityProjectionService>());
        services.AddScoped<IVideoLibrary>(provider => provider.GetRequiredService<EntityProjectionService>());
        services.AddScoped<IVideoSourceService, VideoSourceService>();
        services.AddSingleton(new HlsAssetServiceOptions(cacheDir));
        services.AddSingleton<IHlsAssetService, HlsAssetService>();
        services.AddScoped<IJobQueueService, JobQueueService>();
        services.AddScoped<ISettingsService, SettingsService>();

        return services;
    }
}
