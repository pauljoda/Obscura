using Obscura.Contracts.Settings;
using Obscura.Infrastructure.Settings;

namespace Obscura.Api.Endpoints;

public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/settings")
            .WithTags("Settings");

        group.MapGet("/", (
            ISettingsService settings,
            CancellationToken cancellationToken) =>
            settings.GetAsync(cancellationToken))
            .WithName("GetSettings")
            .WithSummary("Gets application settings.");

        group.MapPatch("/", (
            SettingsUpdateRequestDto request,
            ISettingsService settings,
            CancellationToken cancellationToken) =>
            settings.UpdateAsync(request, cancellationToken))
            .WithName("UpdateSettings")
            .WithSummary("Updates application settings.");

        return group;
    }
}
