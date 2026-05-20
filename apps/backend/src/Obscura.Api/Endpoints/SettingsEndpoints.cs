using Obscura.Application.Settings;
using Obscura.Contracts.Settings;

namespace Obscura.Api.Endpoints;

public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/settings")
            .WithTags("Settings");

        group.MapGet("/", (
            SettingsService settings,
            CancellationToken cancellationToken) =>
            settings.GetAsync(cancellationToken))
            .WithName("GetSettings")
            .WithSummary("Gets application settings.");

        group.MapPatch("/", (
            SettingsUpdateRequest request,
            SettingsService settings,
            CancellationToken cancellationToken) =>
            settings.UpdateAsync(request, cancellationToken))
            .WithName("UpdateSettings")
            .WithSummary("Updates application settings.");

        group.MapGet("/library", (
            SettingsService settings,
            CancellationToken cancellationToken) =>
            settings.GetLibraryConfigAsync(cancellationToken))
            .WithName("GetLibraryConfig")
            .WithSummary("Gets settings and watched roots for the migrated settings page.");

        group.MapPut("/library", (
            LibrarySettingsUpdateRequest request,
            SettingsService settings,
            CancellationToken cancellationToken) =>
            settings.UpdateLibrarySettingsAsync(request, cancellationToken))
            .WithName("UpdateLibrarySettings")
            .WithSummary("Updates settings from the migrated settings page.");

        routes.MapGet("/api/libraries/browse", (
            string? path,
            SettingsService settings,
            CancellationToken cancellationToken) =>
            settings.BrowseLibraryPathAsync(path, cancellationToken))
            .WithTags("Settings")
            .WithName("BrowseLibraryPath")
            .WithSummary("Browses local directories for watched-root selection.");

        routes.MapPost("/api/libraries", (
            LibraryRootCreateRequest request,
            SettingsService settings,
            CancellationToken cancellationToken) =>
            settings.CreateLibraryRootAsync(request, cancellationToken))
            .WithTags("Settings")
            .WithName("CreateLibraryRoot")
            .WithSummary("Adds a watched media root.");

        routes.MapPatch("/api/libraries/{id:guid}", async (
            Guid id,
            LibraryRootUpdateRequest request,
            SettingsService settings,
            CancellationToken cancellationToken) =>
        {
            var root = await settings.UpdateLibraryRootAsync(id, request, cancellationToken);
            return root is null ? Results.NotFound() : Results.Ok(root);
        })
            .WithTags("Settings")
            .WithName("UpdateLibraryRoot")
            .WithSummary("Updates a watched media root.");

        routes.MapDelete("/api/libraries/{id:guid}", async (
            Guid id,
            SettingsService settings,
            CancellationToken cancellationToken) =>
        {
            var deleted = await settings.DeleteLibraryRootAsync(id, cancellationToken);
            return deleted ? Results.Ok(new { ok = true }) : Results.NotFound();
        })
            .WithTags("Settings")
            .WithName("DeleteLibraryRoot")
            .WithSummary("Deletes a watched media root.");

        return group;
    }
}
