using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

internal static class EntityPlaybackEndpoint {
    internal static RouteGroupBuilder MapEntityPlaybackEndpoint(this RouteGroupBuilder group) {
        group.MapPatch("/{id:guid}/playback", async (
            Guid id,
            PlaybackUpdateRequest request,
            EntityCapabilityService capabilities,
            CancellationToken cancellationToken) =>
            EntityEndpointResults.ToResult(id, await capabilities.UpdatePlaybackAsync(
                id, request.ResumeSeconds, request.DurationSeconds, request.Completed, cancellationToken)))
            .WithName("UpdateEntityPlayback")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }
}
