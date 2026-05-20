using Obscura.Contracts.Plugins;
using Obscura.Contracts.System;
using Obscura.Infrastructure.Plugins;

namespace Obscura.Api.Endpoints;

internal static class IdentifyEntityEndpoints {
    internal static RouteGroupBuilder MapIdentifyEntityEndpoints(this RouteGroupBuilder group) {
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

        return group;
    }
}
