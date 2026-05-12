using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Collections;
using Obscura.Application.Entities;
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

        return services;
    }
}
