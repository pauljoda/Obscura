using Obscura.Contracts.Entities;
using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

public static class EntityEndpoints
{
    public static RouteGroupBuilder MapEntityEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/entities")
            .WithTags("Entities");

        group.MapGet("/", (
            string? kind,
            string? query,
            string? cursor) =>
            new EntityListResponseDto([], null))
            .WithName("ListEntities")
            .WithSummary("Lists global entities with optional kind, search, and cursor filters.");

        group.MapGet("/{id:guid}", (Guid id) =>
            Results.NotFound(new ProblemDetailsDto(
                "entity_not_found",
                $"Entity '{id}' was not found.")))
            .WithName("GetEntity")
            .WithSummary("Gets one global entity by id.");

        group.MapPatch("/{id:guid}/rating", (Guid id, RatingUpdateRequestDto request) =>
            Results.NotFound(new ProblemDetailsDto(
                "entity_not_found",
                $"Entity '{id}' was not found.")))
            .WithName("UpdateEntityRating")
            .WithSummary("Updates the shared rating capability for one entity.");

        group.MapPatch("/{id:guid}/flags", (Guid id, EntityFlagsUpdateRequestDto request) =>
            Results.NotFound(new ProblemDetailsDto(
                "entity_not_found",
                $"Entity '{id}' was not found.")))
            .WithName("UpdateEntityFlags")
            .WithSummary("Updates shared boolean flags for one entity.");

        return group;
    }
}
