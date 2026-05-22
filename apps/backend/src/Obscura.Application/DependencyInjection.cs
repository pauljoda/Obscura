using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Obscura.Application.Entities;
using Obscura.Application.Files;
using Obscura.Application.Jobs;
using Obscura.Application.Organization;
using Obscura.Application.Settings;
using Obscura.Application.UserState;
using Obscura.Application.Jobs.Handlers;
using Obscura.Application.Jobs.Handlers.Generate;
using Obscura.Application.Jobs.Handlers.Identity;
using Obscura.Application.Jobs.Handlers.Import;
using Obscura.Application.Jobs.Handlers.Maintenance;
using Obscura.Application.Jobs.Handlers.Probe;
using Obscura.Application.Jobs.Handlers.Scan;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application;

/// <summary>
/// Registers application-layer use-case services.
/// </summary>
public static class DependencyInjection {
    /// <summary>
    /// Adds Obscura application services that orchestrate domain ports for API endpoints and future workers.
    /// </summary>
    public static IServiceCollection AddObscuraApplication(this IServiceCollection services) {
        services.AddScoped<JobService>();
        services.AddScoped<EntityCapabilityService>();
        services.AddScoped<SettingsService>();
        services.AddScoped<UserStateService>();
        services.AddScoped<OrganizeService>();
        services.AddScoped<FilesService>();

        return services;
    }

    /// <summary>
    /// Adds application job handlers, the hosted queue worker, scan scheduler, and history pruner.
    /// </summary>
    public static IServiceCollection AddObscuraWorkerApplication(this IServiceCollection services) {
        // Utility handlers
        services.AddTransient<IJobHandler, NoOpJobHandler>();

        // Scanning
        services.AddTransient<IJobHandler, ScanLibraryJobHandler>();
        services.AddTransient<IJobHandler, ScanGalleryJobHandler>();
        services.AddTransient<IJobHandler, ScanBookJobHandler>();
        services.AddTransient<IJobHandler, ScanAudioJobHandler>();

        // Probing
        services.AddTransient<IJobHandler, ProbeVideoJobHandler>();
        services.AddTransient<IJobHandler, ProbeAudioJobHandler>();

        // Fingerprinting (single handler, registered per job type)
        services.AddTransient<IJobHandler>(sp => new FingerprintJobHandler(
            JobType.FingerprintVideo,
            sp.GetRequiredService<ILogger<FingerprintJobHandler>>(),
            sp.GetRequiredService<IMediaHashing>(),
            sp.GetRequiredService<ILibraryScanPersistence>()));
        services.AddTransient<IJobHandler>(sp => new FingerprintJobHandler(
            JobType.FingerprintImage,
            sp.GetRequiredService<ILogger<FingerprintJobHandler>>(),
            sp.GetRequiredService<IMediaHashing>(),
            sp.GetRequiredService<ILibraryScanPersistence>()));
        services.AddTransient<IJobHandler>(sp => new FingerprintJobHandler(
            JobType.FingerprintAudio,
            sp.GetRequiredService<ILogger<FingerprintJobHandler>>(),
            sp.GetRequiredService<IMediaHashing>(),
            sp.GetRequiredService<ILibraryScanPersistence>()));

        // Preview / asset generation
        services.AddTransient<IJobHandler, GeneratePreviewJobHandler>();
        services.AddTransient<IJobHandler, GenerateImageThumbnailJobHandler>();
        services.AddTransient<IJobHandler, GenerateBookPageThumbnailJobHandler>();
        services.AddTransient<IJobHandler, GenerateAudioWaveformJobHandler>();
        services.AddTransient<IJobHandler, ExtractSubtitlesJobHandler>();

        // Metadata / collections / maintenance
        services.AddTransient<IJobHandler, ImportMetadataJobHandler>();
        services.AddTransient<IJobHandler, RefreshCollectionJobHandler>();
        services.AddTransient<IJobHandler, LibraryMaintenanceJobHandler>();

        // Background services
        services.AddHostedService<QueueWorker>();
        services.AddHostedService<JobScheduler>();
        services.AddHostedService<JobHistoryPruner>();

        return services;
    }
}
