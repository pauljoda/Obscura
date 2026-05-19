using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Obscura.Application.Jobs;
using Obscura.Application.Jobs.Ports;
using Obscura.Application.Settings;
using Obscura.Application.Videos;
using Obscura.Infrastructure.Collections;
using Obscura.Infrastructure.Database;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.Media.Adapters;
using Obscura.Infrastructure.Media.Persistence;
using Obscura.Infrastructure.Media.Processing;
using Obscura.Infrastructure.Organization;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Plugins;
using Obscura.Infrastructure.Processes;
using Obscura.Infrastructure.Queue;
using Obscura.Infrastructure.Settings;
using Obscura.Infrastructure.UserState;
using Obscura.Infrastructure.Videos;

namespace Obscura.Infrastructure;

public static class DependencyInjection {
    public static IServiceCollection AddObscuraInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string? contentRootPath = null) {
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
        services.AddSingleton<ProcessExecutor>();
        services.AddSingleton<MediaToolService>();
        services.AddSingleton<FileDiscoveryService>();
        services.AddSingleton(new AssetPathService(dataDir));
        services.AddSingleton(provider => new MediaProbeService(provider.GetRequiredService<ProcessExecutor>()));
        services.AddSingleton(provider => new ThumbnailService(provider.GetRequiredService<ProcessExecutor>()));
        services.AddSingleton<HashingService>();
        services.AddSingleton(new PluginCatalogOptions(
            ResolvePluginDevPaths(configuration, pathBase),
            cacheDir,
            ResolveCurrentVersion(configuration, pathBase)));
        services.AddSingleton<DotnetPluginProcessRunner>();
        services.AddScoped<PluginCatalogService>();
        services.AddScoped<IdentifyMatchHintResolver>();
        services.AddScoped(provider => new EntityMetadataApplyService(
            provider.GetRequiredService<ObscuraDbContext>(),
            new PluginArtworkServiceOptions(cacheDir),
            provider.GetService<HttpClient>()));
        services.AddScoped<IdentifyPluginService>();
        services.AddSingleton<IdentifySessionStore>();

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
        services.AddScoped<EfEntityRepository>();
        services.AddScoped<EfEntityReadUseCases>();
        services.AddScoped<EntityOrganizerService>();
        services.AddScoped<IVideoSourceService, VideoSourceService>();
        services.AddSingleton(new HlsAssetServiceOptions(
            cacheDir,
            HlsTranscoderProfiles.ParseOrDefault(configuration["OBSCURA_HLS_TRANSCODER"] ?? configuration["Obscura:Hls:Transcoder"]),
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
        services.AddScoped<EfUserStateService>();

        return services;
    }

    private static string NormalizePath(string path, string basePath) =>
        Path.GetFullPath(Path.IsPathRooted(path)
            ? path
            : Path.Combine(basePath, path));

    private static IReadOnlyList<string> ResolvePluginDevPaths(IConfiguration configuration, string basePath) {
        var configured = configuration["OBSCURA_PLUGIN_DEV_PATHS"] ??
            configuration["Obscura:Plugins:DevPaths"];
        var paths = new List<string>();
        if (!string.IsNullOrWhiteSpace(configured)) {
            paths.AddRange(configured
                .Split([',', ';'], StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Select(path => NormalizePath(path, basePath)));
        }

        var repoRoot = FindRepoRoot(basePath);
        if (repoRoot is not null) {
            var siblingCommunityRepo = Path.GetFullPath(Path.Combine(repoRoot, "..", "obscura-community-plugins"));
            if (Directory.Exists(siblingCommunityRepo)) {
                paths.Add(siblingCommunityRepo);
            }

            paths.Add(Path.Combine(repoRoot, "packages", "plugins"));
        }

        return paths.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static string ResolveCurrentVersion(IConfiguration configuration, string basePath) {
        var configured = configuration["OBSCURA_VERSION"] ??
            configuration["Obscura:Version"];
        if (!string.IsNullOrWhiteSpace(configured)) {
            return configured;
        }

        var repoRoot = FindRepoRoot(basePath);
        if (repoRoot is null) {
            return "0.0.0-dev";
        }

        var packageJson = Path.Combine(repoRoot, "package.json");
        if (!File.Exists(packageJson)) {
            return "0.0.0-dev";
        }

        try {
            using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllText(packageJson));
            return document.RootElement.TryGetProperty("version", out var version)
                ? version.GetString() ?? "0.0.0-dev"
                : "0.0.0-dev";
        } catch (System.Text.Json.JsonException) {
            return "0.0.0-dev";
        } catch (IOException) {
            return "0.0.0-dev";
        }
    }

    private static string? FindRepoRoot(string start) {
        var directory = new DirectoryInfo(start);
        while (directory is not null) {
            if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")) &&
                File.Exists(Path.Combine(directory.FullName, "package.json"))) {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        return null;
    }

}
