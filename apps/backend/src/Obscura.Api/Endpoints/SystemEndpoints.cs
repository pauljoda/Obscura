using Obscura.Contracts.System;
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

        return group;
    }

    private static V2UpgradeGateStatusDto ToDto(V2UpgradeGateStatus status)
    {
        return new V2UpgradeGateStatusDto(status.GateId, status.Accepted);
    }
}
