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
        IConfiguration configuration,
        string? contentRootPath = null)
    {
        var configuredConnectionString =
            configuration["DATABASE_URL"] ??
            configuration.GetConnectionString("Obscura") ??
            throw new InvalidOperationException("Obscura requires DATABASE_URL or ConnectionStrings:Obscura.");

        var connectionString = PostgresConnectionString.Normalize(configuredConnectionString);
        var pathBase = contentRootPath ?? Directory.GetCurrentDirectory();
        var dataDir = NormalizePath(configuration["OBSCURA_DATA_DIR"] ??
            configuration["Obscura:DataDir"] ??
            "/data", pathBase);
        var cacheDir = NormalizePath(configuration["OBSCURA_CACHE_DIR"] ??
            configuration["Obscura:CacheDir"] ??
            Path.Combine(dataDir, "cache"), pathBase);

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddDbContext<ObscuraDbContext>((provider, options) =>
            options.UseNpgsql(provider.GetRequiredService<NpgsqlDataSource>()));
        services.AddSingleton(new V2UpgradeGateOptions(dataDir));
        services.AddScoped<IV2UpgradeGate, V2UpgradeGate>();
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
        services.AddSingleton(new HlsAssetServiceOptions(
            cacheDir,
            ParseHlsTranscoderProfile(configuration["OBSCURA_HLS_TRANSCODER"] ?? configuration["Obscura:Hls:Transcoder"]),
            configuration["OBSCURA_FFMPEG_PATH"] ?? configuration["Obscura:Hls:FfmpegPath"] ?? "ffmpeg",
            configuration["OBSCURA_VAAPI_DEVICE"] ?? configuration["Obscura:Hls:VaapiDevice"] ?? "/dev/dri/renderD128"));
        services.AddSingleton<ITranscodeSessionService, TranscodeSessionService>();
        services.AddScoped<IHlsAssetService, HlsAssetService>();
        services.AddScoped<IPlaybackInfoService, PlaybackInfoService>();
        services.AddScoped<IPlaybackSessionService, PlaybackSessionService>();
        services.AddScoped<ITrickplayService, TrickplayService>();
        services.AddScoped<IVideoSubtitleAssetService, VideoSubtitleAssetService>();
        services.AddScoped<IJobQueueService, JobQueueService>();
        services.AddScoped<ISettingsService, SettingsService>();

        return services;
    }

    private static string NormalizePath(string path, string basePath) =>
        Path.GetFullPath(Path.IsPathRooted(path)
            ? path
            : Path.Combine(basePath, path));

    private static HlsTranscoderProfile ParseHlsTranscoderProfile(string? value) =>
        Enum.TryParse<HlsTranscoderProfile>(value, ignoreCase: true, out var profile)
            ? profile
            : HlsTranscoderProfile.Software;
}
