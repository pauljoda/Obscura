using Obscura.Contracts.System;

namespace Obscura.Api.Endpoints;

public static class HealthEndpoints {
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder routes) {
        routes.MapGet("/api/health", () =>
            Results.Ok(new HealthResponse("ok", "dotnet")))
            .WithName("GetHealth")
            .WithSummary("Reports that the Obscura .NET backend is ready to accept requests.");

        return routes;
    }
}
