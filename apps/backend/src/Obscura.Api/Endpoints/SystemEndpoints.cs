using Obscura.Contracts.System;
using Obscura.Infrastructure.FreshStart;
using Obscura.Infrastructure.Upgrades;

namespace Obscura.Api.Endpoints;

public static class SystemEndpoints
{
    public static RouteGroupBuilder MapSystemEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/system")
            .WithTags("System");

        group.MapGet("/v2-upgrade-gate", (IV2UpgradeGate gate) =>
            ToDto(gate.Check()))
            .WithName("GetV2UpgradeGate")
            .WithSummary("Reports whether the v2 global entity upgrade has user consent.");

        group.MapPost("/v2-upgrade-gate/accept", (IV2UpgradeGate gate) =>
            ToDto(gate.Accept()))
            .WithName("AcceptV2UpgradeGate")
            .WithSummary("Records consent for the v2 global entity upgrade.");

        group.MapPost("/v2-fresh-start/prepare", async (
            IV2UpgradeGate gate,
            IV2FreshStartService freshStart,
            CancellationToken cancellationToken) =>
        {
            var status = gate.Check();
            if (!status.Accepted)
            {
                return Results.Conflict(new ProblemDetailsDto(
                    "v2_upgrade_consent_required",
                    "Accept the v2 global entity upgrade gate before preparing the fresh-start migration."));
            }

            var result = await freshStart.PrepareAsync(cancellationToken);
            return Results.Ok(new V2FreshStartPrepareResponseDto(
                result.BackupPath,
                result.PreservedLibraryRoots,
                result.PreservedSettings,
                result.MediaReset));
        })
            .WithName("PrepareV2FreshStart")
            .WithSummary("Backs up the current database and preserves settings/library roots for a v2 fresh start.");

        return group;
    }

    private static V2UpgradeGateStatusDto ToDto(V2UpgradeGateStatus status)
    {
        return new V2UpgradeGateStatusDto(status.GateId, status.Accepted);
    }
}
