using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;

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

        return group;
    }
}
