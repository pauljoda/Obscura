using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

internal static class EntityMarkerEndpoints {
    internal static RouteGroupBuilder MapEntityMarkerEndpoints(this RouteGroupBuilder group) {
        group.MapPost("/{id:guid}/markers", async (
            Guid id,
            EntityMarkerWriteRequest request,
            EntityCapabilityService capabilities,
            CancellationToken cancellationToken) =>
            EntityEndpointResults.ToResult(id, await capabilities.AddMarkerAsync(
                id, request.Title, request.Seconds, request.EndSeconds, cancellationToken)))
            .WithName("CreateEntityMarker")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/markers/{markerId:guid}", async (
            Guid id,
            Guid markerId,
            EntityMarkerWriteRequest request,
            EntityCapabilityService capabilities,
            CancellationToken cancellationToken) =>
            EntityEndpointResults.ToResult(id, await capabilities.UpdateMarkerAsync(
                id, markerId, request.Title, request.Seconds, request.EndSeconds, cancellationToken)))
            .WithName("UpdateEntityMarker")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapDelete("/{id:guid}/markers/{markerId:guid}", async (
            Guid id,
            Guid markerId,
            EntityCapabilityService capabilities,
            CancellationToken cancellationToken) =>
            EntityEndpointResults.ToResult(id, await capabilities.DeleteMarkerAsync(id, markerId, cancellationToken)))
            .WithName("DeleteEntityMarker")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}
