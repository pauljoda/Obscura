using Obscura.Api.Mapping;
using Obscura.Application.Migrations;
using Obscura.Contracts.System;
using Microsoft.Extensions.Hosting;

namespace Obscura.Api.Endpoints;

public static class SystemEndpoints
{
    public static RouteGroupBuilder MapSystemEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/system")
            .WithTags("System");

        group.MapGet("/v2-upgrade-gate", (SystemMigrationService migrations) =>
            migrations.GetUpgradeGateStatus().ToContract())
            .WithName("GetV2UpgradeGate")
            .WithSummary("Reports whether the v2 global entity upgrade has user consent.");

        group.MapPost("/v2-upgrade-gate/accept", (SystemMigrationService migrations) =>
            migrations.AcceptUpgradeGate().ToContract())
            .WithName("AcceptV2UpgradeGate")
            .WithSummary("Records consent for the v2 global entity upgrade.");

        group.MapPost("/v2-upgrade-gate/prompt", async (
            SystemMigrationService migrations,
            IHostEnvironment env,
            CancellationToken cancellationToken) =>
            env.IsDevelopment()
                ? Results.Ok((await migrations.PromptUpgradeGateAsync(cancellationToken)).ToContract())
                : Results.NotFound())
            .WithName("PromptV2UpgradeGate")
            .WithSummary("Re-arms the v2 global entity upgrade gate for local migration testing without deleting existing v2 data.");

        group.MapPost("/v2-fresh-start/prepare", async (
            SystemMigrationService migrations,
            CancellationToken cancellationToken) =>
        {
            var result = await migrations.PrepareFreshStartAsync(cancellationToken);
            return result.Response is not null
                ? Results.Ok(result.Response.ToContract())
                : Results.Conflict(result.Problem?.ToContract());
        })
            .WithName("PrepareV2FreshStart")
            .WithSummary("Backs up the current database and preserves settings/library roots for a v2 fresh start.")
            .Produces<V2FreshStartPrepareResponse>()
            .Produces<ApiProblem>(StatusCodes.Status409Conflict);

        group.MapPost("/v2-legacy-video-import", async (
            SystemMigrationService migrations,
            CancellationToken cancellationToken) =>
            Results.Ok((await migrations.ImportLegacyVideosAsync(cancellationToken)).ToContract()))
            .WithName("ImportLegacyVideos")
            .WithSummary("Imports legacy video and series metadata into the v2 global entity tables for side-by-side migration testing.")
            .Produces<LegacyVideoImportResponse>();

        group.MapPost("/v2-legacy-media-import", async (
            SystemMigrationService migrations,
            CancellationToken cancellationToken) =>
            Results.Ok((await migrations.ImportLegacyMediaAsync(cancellationToken)).ToContract()))
            .WithName("ImportLegacyMedia")
            .WithSummary("Imports legacy image, gallery, book, and audio metadata into the v2 global entity tables for side-by-side migration testing.")
            .Produces<LegacyMediaImportResponse>();

        return group;
    }
}
