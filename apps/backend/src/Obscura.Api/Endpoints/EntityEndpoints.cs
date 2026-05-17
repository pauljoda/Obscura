using Obscura.Application.Entities;
using Obscura.Contracts.Entities;
using Obscura.Contracts.System;
using Obscura.Domain.Entities;

namespace Obscura.Api.Endpoints;

public static class EntityEndpoints
{
    public static RouteGroupBuilder MapEntityEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/entities")
            .WithTags("Entities");

        group.MapGet("/", async (
            string? query,
            string? cursor,
            bool? hideNsfw,
            HttpContext httpContext,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                if (!TryGetEntityKindQuery(httpContext, out var kind, out var error))
                {
                    return error;
                }

                return Results.Ok(await entities.ListAsync(new EntityListQuery(kind, query, cursor, hideNsfw), cancellationToken));
            })
            .WithName("ListEntities")
            .WithSummary("Lists global entities with optional kind, search, and cursor filters.")
            .Produces<EntityListResponse>()
            .Produces<ApiProblem>(StatusCodes.Status400BadRequest);

        group.MapGet("/{id:guid}", async (
            Guid id,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.GetAsync(id, cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("GetEntity")
            .WithSummary("Gets one global entity by id.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPost("/thumbnails", async (
            EntityThumbnailBatchRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            Results.Ok(await entities.GetThumbnailsAsync(request.Ids, cancellationToken)))
            .WithName("GetEntityThumbnails")
            .WithSummary("Resolves lightweight thumbnails for entity grids and relationship previews.")
            .Produces<EntityThumbnailBatchResponse>();

        group.MapPatch("/{id:guid}/rating", async (
            Guid id,
            RatingUpdateRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.SetRatingAsync(
                    new SetEntityRatingCommand(id, request.Value),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("UpdateEntityRating")
            .WithSummary("Updates the shared rating capability for one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/flags", async (
            Guid id,
            EntityFlagsUpdateRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.UpdateFlagsAsync(
                    new UpdateEntityFlagsCommand(
                        id,
                        request.IsFavorite,
                        request.IsNsfw,
                        request.IsOrganized),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("UpdateEntityFlags")
            .WithSummary("Updates shared boolean flags for one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/playback", async (
            Guid id,
            PlaybackUpdateRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.UpdatePlaybackAsync(
                    new UpdatePlaybackCommand(
                        id,
                        request.ResumeSeconds,
                        request.DurationSeconds,
                        request.Completed),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("UpdateEntityPlayback")
            .WithSummary("Updates playback state (resume position, duration, completion) for one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPost("/{id:guid}/markers", async (
            Guid id,
            EntityMarkerWriteRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.CreateMarkerAsync(
                    new CreateEntityMarkerCommand(
                        id,
                        request.Title,
                        request.Seconds,
                        request.EndSeconds),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("CreateEntityMarker")
            .WithSummary("Adds a timeline marker to one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapPatch("/{id:guid}/markers/{markerId:guid}", async (
            Guid id,
            Guid markerId,
            EntityMarkerWriteRequest request,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.UpdateMarkerAsync(
                    new UpdateEntityMarkerCommand(
                        id,
                        markerId,
                        request.Title,
                        request.Seconds,
                        request.EndSeconds),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("UpdateEntityMarker")
            .WithSummary("Updates a timeline marker for one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        group.MapDelete("/{id:guid}/markers/{markerId:guid}", async (
            Guid id,
            Guid markerId,
            EntityService entities,
            CancellationToken cancellationToken) =>
            {
                var entity = await entities.DeleteMarkerAsync(
                    new DeleteEntityMarkerCommand(id, markerId),
                    cancellationToken);

                return entity is null
                    ? Results.NotFound(new ApiProblem(
                        "entity_not_found",
                        $"Entity '{id}' was not found."))
                    : Results.Ok(entity);
            })
            .WithName("DeleteEntityMarker")
            .WithSummary("Deletes a timeline marker from one entity.")
            .Produces<EntityCard>()
            .Produces<ApiProblem>(StatusCodes.Status404NotFound);

        return group;
    }

    private static bool TryGetEntityKindQuery(
        HttpContext httpContext,
        out IEntityKind? entityKind,
        out IResult error)
    {
        entityKind = null;
        error = Results.Empty;

        var rawValue = httpContext.Request.Query["kind"].ToString();
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return true;
        }

        if (EntityKindRegistry.TryGet(rawValue, out var resolvedKind))
        {
            entityKind = resolvedKind;
            return true;
        }

        error = Results.BadRequest(new ApiProblem(
            "invalid_entity_kind",
            $"Entity kind '{rawValue}' is not recognized."));
        return false;
    }
}

/// <summary>
/// Query-bound entity kind value that decodes public kind codes at the HTTP edge.
/// </summary>
/// <param name="Value">Typed entity kind resolved from the query string.</param>
public readonly record struct EntityKindQuery(IEntityKind Value)
{
    /// <summary>
    /// Attempts to parse a query-string value into a known entity kind.
    /// </summary>
    /// <param name="value">Query-string value supplied by the API caller.</param>
    /// <param name="provider">Format provider supplied by the minimal API binder.</param>
    /// <param name="result">Parsed query value when the kind code is known.</param>
    /// <returns>True when the query value maps to a registered entity kind.</returns>
    public static bool TryParse(string? value, IFormatProvider? provider, out EntityKindQuery result)
    {
        if (value is not null && EntityKindRegistry.TryGet(value, out var kind))
        {
            result = new EntityKindQuery(kind);
            return true;
        }

        result = default;
        return false;
    }
}
