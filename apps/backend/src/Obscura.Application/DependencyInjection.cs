using Microsoft.Extensions.DependencyInjection;
using Obscura.Application.Collections;
using Obscura.Application.Entities;
using Obscura.Application.Videos;

namespace Obscura.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddObscuraApplication(this IServiceCollection services)
    {
        services.AddScoped<EntityService>();
        services.AddScoped<VideoService>();
        services.AddScoped<CollectionService>();

        return services;
    }
}
