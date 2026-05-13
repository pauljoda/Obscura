using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Obscura.Application.Collections;
using Obscura.Application.Entities;
using Obscura.Application.Jobs;
using Obscura.Application.Jobs.Handlers;
using Obscura.Application.Media;
using Obscura.Application.Migrations;
using Obscura.Application.Taxonomy;
using Obscura.Application.Videos;

namespace Obscura.Application;

/// <summary>
/// Registers application-layer use-case services.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds Obscura application services that orchestrate domain ports for API endpoints and future workers.
    /// </summary>
    public static IServiceCollection AddObscuraApplication(this IServiceCollection services)
    {
        services.AddScoped<EntityService>();
        services.AddScoped<VideoService>();
        services.AddScoped<CollectionService>();
        services.AddScoped<MediaService>();
        services.AddScoped<TaxonomyService>();
        services.AddScoped<JobService>();
        services.AddScoped<SystemMigrationService>();

        return services;
    }

    /// <summary>
    /// Adds application job handlers, the hosted queue worker, scan scheduler, and history pruner.
    /// </summary>
    public static IServiceCollection AddObscuraWorkerApplication(this IServiceCollection services)
    {
        // Legacy / utility handlers
        services.AddTransient<IJobHandler, NoOpJobHandler>();
        services.AddTransient<IJobHandler, LegacyVideoImportJobHandler>();
        services.AddTransient<IJobHandler, LegacyMediaImportJobHandler>();

        // Scanning
        services.AddTransient<IJobHandler, ScanLibraryJobHandler>();
        services.AddTransient<IJobHandler, ScanGalleryJobHandler>();
        services.AddTransient<IJobHandler, ScanBookJobHandler>();
        services.AddTransient<IJobHandler, ScanAudioJobHandler>();

        // Probing
        services.AddTransient<IJobHandler, ProbeVideoJobHandler>();
        services.AddTransient<IJobHandler, ProbeAudioJobHandler>();

        // Fingerprinting
        services.AddTransient<IJobHandler, FingerprintVideoJobHandler>();
        services.AddTransient<IJobHandler, FingerprintImageJobHandler>();
        services.AddTransient<IJobHandler, FingerprintAudioJobHandler>();

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
