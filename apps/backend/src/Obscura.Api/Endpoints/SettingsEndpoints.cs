using Obscura.Contracts.Settings;

namespace Obscura.Api.Endpoints;

public static class SettingsEndpoints
{
    private static readonly SettingsDto Defaults = new(
        HideNsfw: false,
        EnableCastControls: true);

    public static RouteGroupBuilder MapSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/settings")
            .WithTags("Settings");

        group.MapGet("/", () => Defaults)
            .WithName("GetSettings")
            .WithSummary("Gets application settings.");

        group.MapPatch("/", (SettingsUpdateRequestDto request) =>
            Defaults with
            {
                HideNsfw = request.HideNsfw ?? Defaults.HideNsfw,
                EnableCastControls = request.EnableCastControls ?? Defaults.EnableCastControls
            })
            .WithName("UpdateSettings")
            .WithSummary("Updates application settings.");

        return group;
    }
}
