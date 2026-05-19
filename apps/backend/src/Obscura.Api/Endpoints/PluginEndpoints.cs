using Obscura.Contracts.Plugins;
using Obscura.Contracts.System;
using Obscura.Infrastructure.Plugins;

namespace Obscura.Api.Endpoints;

public static class PluginEndpoints {
    public static RouteGroupBuilder MapPluginEndpoints(this IEndpointRouteBuilder routes) {
        var group = routes.MapGroup("/api/plugins")
            .WithTags("Plugins");

        group.MapGet("/", async (
            PluginCatalogService plugins,
            CancellationToken cancellationToken) =>
            Results.Ok(await plugins.ListProvidersAsync(cancellationToken)))
            .WithName("ListPlugins")
            .WithSummary("Lists compatible v2 community plugins discovered from installed and local development sources.")
            .Produces<IReadOnlyList<PluginProvider>>();

        group.MapPost("/{provider}", async (
            string provider,
            PluginCatalogService plugins,
            CancellationToken cancellationToken) => {
                var result = await plugins.InstallAsync(provider, cancellationToken);
                return result is null
                    ? Results.NotFound(new ApiProblem("plugin_not_found", $"Plugin provider '{provider}' was not found or is not compatible."))
                    : Results.Ok(result);
            })
            .WithName("InstallPlugin")
            .WithSummary("Marks a compatible v2 community plugin as installed and enabled.")
            .Produces<PluginProvider>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapDelete("/{provider}", async (
            string provider,
            PluginCatalogService plugins,
            CancellationToken cancellationToken) =>
            await plugins.RemoveAsync(provider, cancellationToken)
                ? Results.NoContent()
                : Results.NotFound(new ApiProblem("plugin_not_found", $"Plugin provider '{provider}' is not installed.")))
            .WithName("RemovePlugin")
            .WithSummary("Removes local installed state for a v2 community plugin.")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPut("/{provider}/auth", async (
            string provider,
            PluginAuthUpdateRequest request,
            PluginCatalogService plugins,
            CancellationToken cancellationToken) =>
            await plugins.SaveAuthAsync(provider, request.Values, cancellationToken)
                ? Results.NoContent()
                : Results.NotFound(new ApiProblem("plugin_not_found", $"Plugin provider '{provider}' was not found or is not compatible.")))
            .WithName("UpdatePluginAuth")
            .WithSummary("Stores credential values for a v2 community plugin provider.")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}

public static class IdentifyEndpoints {
    public static RouteGroupBuilder MapIdentifyEndpoints(this IEndpointRouteBuilder routes) {
        var group = routes.MapGroup("/api/identify")
            .WithTags("Identify");

        group.MapGet("/providers", async (
            string? kind,
            IdentifyPluginService identify,
            CancellationToken cancellationToken) =>
            Results.Ok(await identify.ListProvidersAsync(kind, cancellationToken)))
            .WithName("ListIdentifyProviders")
            .WithSummary("Lists compatible v2 providers that can identify the requested entity kind.")
            .Produces<IReadOnlyList<PluginProvider>>();

        group.MapPost("/entities/{entityId:guid}", async (
            Guid entityId,
            IdentifyEntityRequest request,
            IdentifyPluginService identify,
            CancellationToken cancellationToken) => {
                var response = await identify.IdentifyAsync(entityId, request.Provider, request.Query, cancellationToken);
                return response.Ok
                    ? Results.Ok(response.Result)
                    : Results.BadRequest(new ApiProblem("identify_failed", response.Error ?? "Identify failed."));
            })
            .WithName("IdentifyEntity")
            .WithSummary("Runs one transient v2 metadata identify lookup for an entity.")
            .Produces<EntityMetadataProposal>()
            .Produces<ApiProblem>(StatusCodes.Status400BadRequest);

        group.MapPost("/entities/{entityId:guid}/apply", async (
            Guid entityId,
            ApplyIdentifyProposalRequest request,
            IdentifyPluginService identify,
            CancellationToken cancellationToken) => {
                var applied = await identify.ApplyAsync(
                    entityId,
                    request.Proposal,
                    request.SelectedFields,
                    request.SelectedImages,
                    cancellationToken);
                if (!applied) {
                    return Results.NotFound(new ApiProblem("entity_not_found", $"Entity '{entityId}' was not found."));
                }

                return Results.NoContent();
            })
            .WithName("ApplyIdentifyProposal")
            .WithSummary("Applies selected fields from a transient identify proposal to the entity.")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPost("/bulk", (
            IdentifyBulkStartRequest request,
            IdentifySessionStore sessions,
            IServiceScopeFactory scopes,
            CancellationToken cancellationToken) => {
                if (request.EntityIds.Count == 0) {
                    return Results.BadRequest(new ApiProblem("empty_bulk_identify", "Bulk identify requires at least one entity."));
                }

                var session = sessions.Create(request.EntityIds, request.Provider);
                _ = Task.Run(async () => {
                    using var scope = scopes.CreateScope();
                    var identify = scope.ServiceProvider.GetRequiredService<IdentifyPluginService>();
                    var results = new List<IdentifyBulkResult>();
                    foreach (var entityId in request.EntityIds) {
                        var response = await identify.IdentifyAsync(entityId, request.Provider, request.Query, CancellationToken.None);
                        results.Add(new IdentifyBulkResult(entityId, response));
                    }

                    sessions.Complete(session.Id, results);
                }, cancellationToken);

                return Results.Accepted($"/api/identify/bulk/{session.Id}", session);
            })
        .WithName("StartBulkIdentify")
        .WithSummary("Starts a transient in-memory bulk identify review session.")
        .Produces<IdentifyBulkSession>(StatusCodes.Status202Accepted)
        .Produces<ApiProblem>(StatusCodes.Status400BadRequest);

        group.MapGet("/bulk/{sessionId:guid}", (
            Guid sessionId,
            IdentifySessionStore sessions) => {
                var session = sessions.Get(sessionId);
                return session is null
                    ? Results.NotFound(new ApiProblem("identify_session_not_found", $"Identify session '{sessionId}' was not found."))
                    : Results.Ok(session);
            })
        .WithName("GetBulkIdentifySession")
        .WithSummary("Gets transient bulk identify session status and results.")
        .Produces<IdentifyBulkSession>()
        .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapDelete("/bulk/{sessionId:guid}", (
            Guid sessionId,
            IdentifySessionStore sessions) =>
        sessions.Close(sessionId)
            ? Results.NoContent()
            : Results.NotFound(new ApiProblem("identify_session_not_found", $"Identify session '{sessionId}' was not found.")))
        .WithName("CloseBulkIdentifySession")
        .WithSummary("Closes a transient bulk identify review session.")
        .Produces(StatusCodes.Status204NoContent)
        .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}
