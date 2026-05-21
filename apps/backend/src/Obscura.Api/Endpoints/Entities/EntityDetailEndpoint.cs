using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;
using Obscura.Infrastructure.Plugins;

namespace Obscura.Api.Endpoints;

internal static class EntityDetailEndpoint {
    internal static RouteGroupBuilder MapEntityDetailEndpoint(this RouteGroupBuilder group) {
        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityReadService entities,
            CancellationToken cancellationToken) =>
            await EntityEndpointResults.GetEntityAsync(id, entities, cancellationToken))
            .WithName("GetEntity")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}", async (
            Guid id,
            EntityMetadataUpdateRequest request,
            EntityMetadataApplyService metadata,
            IEntityReadService entities,
            CancellationToken cancellationToken) => {
                bool applied;
                try {
                    applied = await metadata.ApplyPatchAsync(id, request, cancellationToken);
                } catch (ArgumentException ex) {
                    return Results.BadRequest(new ApiProblem("invalid_entity_metadata_patch", ex.Message));
                }

                if (!applied) {
                    return Results.NotFound(new ApiProblem("entity_not_found", $"Entity '{id}' was not found."));
                }

                return await EntityEndpointResults.GetEntityAsync(id, entities, cancellationToken);
            })
            .WithName("UpdateEntity")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status400BadRequest)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}
