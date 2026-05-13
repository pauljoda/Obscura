using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Obscura.Application.Collections;
using Obscura.Application.Entities;
using Obscura.Application.Jobs;
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
    /// <param name="services">Service collection being configured by the host.</param>
    /// <returns>The same service collection for fluent startup configuration.</returns>
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
    /// Adds application job handlers and the hosted queue worker used by the worker executable host.
    /// </summary>
    /// <param name="services">Service collection being configured by the worker host.</param>
    /// <returns>The same service collection for fluent startup configuration.</returns>
    public static IServiceCollection AddObscuraWorkerApplication(this IServiceCollection services)
    {
        services.AddSingleton<IJobHandler, NoOpJobHandler>();
        services.AddSingleton<IJobHandler, LegacyVideoImportJobHandler>();
        services.AddSingleton<IJobHandler, LegacyMediaImportJobHandler>();
        services.AddHostedService<QueueWorker>();

        return services;
    }
}
