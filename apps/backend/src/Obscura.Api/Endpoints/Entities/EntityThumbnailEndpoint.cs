using Obscura.Application.Entities;
using Obscura.Contracts.Entities;

namespace Obscura.Api.Endpoints;

internal static class EntityThumbnailEndpoint {
    internal static RouteGroupBuilder MapEntityThumbnailEndpoint(this RouteGroupBuilder group) {
        group.MapPost("/thumbnails", async (
            EntityThumbnailBatchRequest request,
            IEntityReadService entities,
            CancellationToken cancellationToken) =>
            Results.Ok(await entities.GetThumbnailsAsync(request.Ids, cancellationToken)))
            .WithName("GetEntityThumbnails")
            .Produces<EntityThumbnailBatchResponse>();

        return group;
    }
}
