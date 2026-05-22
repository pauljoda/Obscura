using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

internal static class EntityKindRouteEndpoints {
    internal static RouteGroupBuilder MapEntityKindRoutes(
        this IEndpointRouteBuilder routes,
        string prefix,
        string kind,
        string tag,
        string listName,
        string detailName,
        Type listResponseType,
        Type detailResponseType) {
        var group = routes.MapGroup(prefix)
            .WithTags(tag);

        group.MapGet("/", async (
            string? query,
            string? cursor,
            bool? hideNsfw,
            int? limit,
            IEntityReadService entities,
            CancellationToken cancellationToken) =>
            Results.Ok(await entities.ListAsync(kind, query, cursor, hideNsfw, limit, cancellationToken)))
            .WithName(listName)
            .Produces(StatusCodes.Status200OK, listResponseType);

        group.MapGet("/{id:guid}", async (
            Guid id,
            IEntityReadService entities,
            CancellationToken cancellationToken) =>
            await GetKindDetailAsync(id, kind, entities, cancellationToken))
            .WithName(detailName)
            .Produces(StatusCodes.Status200OK, detailResponseType)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}", async (
            Guid id,
            EntityMetadataUpdateRequest request,
            IEntityMetadataPatchService metadata,
            IEntityReadService entities,
            CancellationToken cancellationToken) =>
            await EntityDetailEndpoint.PatchEntityAsync(id, kind, request, metadata, entities, cancellationToken))
            .WithName($"{detailName}Patch")
            .Produces(StatusCodes.Status200OK, detailResponseType)
            .Produces<ApiProblem>(StatusCodes.Status400BadRequest)
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }

    internal static async Task<IResult> GetKindDetailAsync(
        Guid id,
        string kind,
        IEntityReadService entities,
        CancellationToken cancellationToken) {
        var entity = await entities.GetDetailAsync(id, kind, cancellationToken);
        return entity is null
            ? Results.NotFound(new ApiProblem("entity_not_found", $"Entity '{id}' was not found."))
            : Results.Ok<object>(entity);
    }
}
