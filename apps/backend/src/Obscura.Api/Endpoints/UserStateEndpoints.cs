using System.Reflection;
using System.Text.Json.Nodes;
using Obscura.Application.UserState;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

public static class UserStateEndpoints
{
    public static IEndpointRouteBuilder MapUserStateEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/update-check", () =>
            Results.Ok(new
            {
                status = "unknown",
                localVersion = Assembly.GetExecutingAssembly()
                    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown",
                latestVersion = (string?)null,
                latestUrl = (string?)null,
                updateAvailable = false,
                checkedAt = DateTimeOffset.UtcNow,
                fromCache = false,
                error = "Update checks are not available in the .NET API host yet."
            }))
            .WithName("GetUpdateCheck")
            .WithTags("User State")
            .WithSummary("Returns a non-blocking update-check status for the Svelte shell.");

        routes.MapGet("/api/playlist-session", async (
            IUserStateService userState,
            CancellationToken cancellationToken) =>
        {
            var valueJson = await userState.GetPlaylistSessionJsonAsync(cancellationToken);
            return Results.Text(
                string.IsNullOrWhiteSpace(valueJson) ? "null" : valueJson,
                "application/json");
        })
            .WithName("GetPlaylistSession")
            .WithTags("User State")
            .WithSummary("Gets the current browser playlist session.");

        routes.MapPut("/api/playlist-session", async (
            HttpRequest request,
            IUserStateService userState,
            CancellationToken cancellationToken) =>
        {
            JsonNode? node;
            try
            {
                node = await JsonNode.ParseAsync(request.Body, cancellationToken: cancellationToken);
            }
            catch
            {
                return Results.BadRequest(new ApiProblem("playlist_session_invalid", "Playlist session payload must be valid JSON."));
            }

            if (node is not JsonObject session)
            {
                return Results.BadRequest(new ApiProblem("playlist_session_invalid", "Playlist session payload must be a JSON object."));
            }

            session["updatedAt"] = DateTimeOffset.UtcNow;
            var valueJson = session.ToJsonString();
            await userState.SavePlaylistSessionJsonAsync(valueJson, cancellationToken);
            return Results.Text(valueJson, "application/json");
        })
            .WithName("PutPlaylistSession")
            .WithTags("User State")
            .WithSummary("Stores the current browser playlist session.");

        routes.MapDelete("/api/playlist-session", async (
            IUserStateService userState,
            CancellationToken cancellationToken) =>
        {
            await userState.ClearPlaylistSessionAsync(cancellationToken);
            return Results.Ok(new { ok = true });
        })
            .WithName("DeletePlaylistSession")
            .WithTags("User State")
            .WithSummary("Clears the current browser playlist session.");

        return routes;
    }
}
